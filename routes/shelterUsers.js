const express = require("express");
const bcrypt = require("bcryptjs");
const { check } = require("express-validator");

const {
	asyncHandler,
	handleValidationErrors,
	validatePassword,
} = require("../utils");
const { getShelterToken, requireShelterAuth } = require("../auth");
const db = require("../db/models");

const router = express.Router();

const { Pet, ShelterUser, AdoptionRequest, State } = db;

router.get(
	"/:id",
	requireShelterAuth,
	asyncHandler(async (req, res, next) => {
		const shelterUserId = parseInt(req.params.id, 10);
		console.log("yyyyy", shelterUserId);

		// if (req.user.id !== shelterUserId || req.role !== "Shelter") {
		// 	console.log("rkkkkk", req.user);
		// 	const err = new Error("Unauthorized");
		// 	err.status = 401;
		// 	err.message = "You do not have permission(s) to do that.";
		// 	err.title = "Unauthorized";
		// 	throw err;
		// }

		const shelterUser = await ShelterUser.findByPk(shelterUserId, {
			include: [State],
			attributes: { exclude: ["hashedPassword"] },
		});

		if (shelterUser) {
			res.json({ shelterUser });
		} else {
			next(shelterUserNotFoundError(shelterUserId));
		}
	})
);

const validateEmailAndPassword = [
	check("email")
		.exists({ checkFalsy: true })
		.isEmail()
		.withMessage("Please provide a valid email."),
	check("password")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a password."),
];
const validateLoginShelter = [
	check("email")
		.exists({ checkFalsy: true })
		.isEmail()
		.withMessage("Please provide a valid email."),
	check("password")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a password."),
	check("shelterName")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a shelter name.")
		.isLength({ max: 128 })
		.withMessage("Name cannot be longer than 128 character."),
	check("phoneNum")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a phone number."),
	check("address")
		.exists({ checkFalsy: true })
		.withMessage("Please provide an address"),
	check("city")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a city name."),
	check("stateId")
		.exists({ checkFalsy: true })
		.withMessage("Please select a state."),
	check("zipCode")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a zip code.")
		.isLength({ max: 5 })
		.withMessage("Please provide a valid zip code."),
];

router.post(
	"/",
	validateLoginShelter,
	validateEmailAndPassword,
	handleValidationErrors,
	asyncHandler(async (req, res) => {
		const {
			email,
			password,
			shelterName,
			phoneNum,
			address,
			city,
			stateId,
			zipCode,
		} = req.body;
		const hashedPassword = await bcrypt.hash(password, 10);
		const user = await ShelterUser.create({
			email,
			hashedPassword,
			shelterName,
			phoneNum,
			address,
			city,
			stateId,
			zipCode,
		});

		const tokenShelter = getShelterToken(user);
		console.log("checkpost", tokenShelter);
		const role = "Shelter";
		res.status(201).json({
			user: { id: user.id },
			role,
			tokenShelter,
			name: user.shelterName,
		});
	})
);

router.post(
	"/login",
	asyncHandler(async (req, res, next) => {
		const { email, password } = req.body;
		const shelterUser = await ShelterUser.findOne({
			where: {
				email,
			},
		});

		if (
			!shelterUser ||
			!validatePassword(password, shelterUser.hashedPassword)
		) {
			const err = new Error("Login failed");
			err.status = 401;
			err.title = "Login failed";
			err.errors = ["The provided credentials were invalid."];
			return next(err);
		}
		const tokenShelter = getShelterToken(shelterUser);
		const role = "Shelter";
		res.json({
			tokenShelter,
			role,
			user: { id: shelterUser.id },
			name: shelterUser.shelterName,
		});
	})
);

const shelterUserNotFoundError = (id) => {
	const err = Error(`Shelter user with id of ${id} could not be found.`);
	err.title = "Shelter user not found.";
	err.status = 404;
	return err;
};

router.put(
	"/:id(\\d+)",
	requireShelterAuth,
	handleValidationErrors,
	asyncHandler(async (req, res, next) => {
		const shelterUserId = parseInt(req.params.id, 10);
		const shelterUser = await ShelterUser.findByPk(shelterUserId);

		if (shelterUser) {
			let hashedPassword;
			if (req.body.password) {
				hashedPassword = await bcrypt.hash(req.body.password, 10);
			}
			await shelterUser.update({
				email: req.body.email,
				hashedPassword: hashedPassword,
				shelterName: req.body.shelterName,
				phoneNum: req.body.phoneNum,
				city: req.body.city,
				stateId: req.body.stateIdId,
				zipCode: req.body.zipCode,
			});
			const updatedShelterUser = await ShelterUser.findByPk(shelterUserId, {
				attributes: { exclude: ["hashedPassword"] },
			});
			res.json({ updatedShelterUser });
		} else {
			next(shelterUserNotFoundError(shelterUserId));
		}
	})
);

router.delete(
	"/:id(\\d+)",
	requireShelterAuth,
	asyncHandler(async (req, res, next) => {
		const shelterUserId = parseInt(req.params.id, 10);
		const shelterUser = await ShelterUser.findByPk(shelterUserId);

		if (shelterUser) {
			const adoptionRequests = await AdoptionRequest.findAll({
				where: {
					shelterId: shelterUserId,
				},
			});
			adoptionRequests.forEach(async (request) => await request.destroy());

			const pets = await Pet.findAll({
				where: {
					shelterId: shelterUserId,
				},
			});
			pets.forEach(async (pet) => await pet.destroy());

			await shelterUser.destroy();
			res.status(204).end();
		} else {
			next(shelterUserNotFoundError(shelterUserId));
		}
	})
);
module.exports = router;
