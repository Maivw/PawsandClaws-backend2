const express = require("express");
const { check } = require("express-validator");

const { asyncHandler, handleValidationErrors } = require("../utils");
const { requireShelterAuth } = require("../auth");
const db = require("../db/models");
const upload = require("../upload");
const _ = require("lodash");

const router = express.Router();

const { Pet, Breed, ShelterUser } = db;

router.get(
	"/",
	asyncHandler(async (req, res) => {
		const pets = await Pet.findAll({
			order: [["createdAt", "DESC"]],
			include: [Breed, ShelterUser],
			where: { isAdopted: false },
		});
		res.json({ pets });
	})
);
router.get(
	"/shelters/:id",
	asyncHandler(async (req, res) => {
		const shelterUserId = parseInt(req.params.id, 10);
		// const { id } = req.body;
		const pets = await Pet.findAll({
			order: [["createdAt", "DESC"]],
			include: [Breed, ShelterUser],
			where: { shelterId: shelterUserId },
			// where: { shelterId: id },
		});
		res.json({ pets });
	})
);

const petNotFoundError = (id) => {
	const err = Error("Pet not found");
	err.errors = [`Pet with id of ${id} could not be found.`];
	err.title = "Pet not found.";
	err.status = 404;
	return err;
};

router.get(
	"/:id",
	asyncHandler(async (req, res, next) => {
		const pet = await Pet.findOne({
			where: {
				id: req.params.id,
			},
			include: [Breed, ShelterUser],
		});
		if (pet) {
			res.json({ pet });
		} else {
			next(petNotFoundError(req.params.id));
		}
	})
);

const validatePet = [
	check("breedId")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a value for breed"),
	check("petName")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a name for the pet")
		.isLength({ max: 255 })
		.withMessage("Pet Name must not be more than 128 characters long"),
	check("age")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a value for age"),
	check("sex")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a value for sex"),
	check("size")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a value for size"),
	check("description")
		.exists({ checkFalsy: true })
		.withMessage("Please provide a description for the pet"),
	handleValidationErrors,
];

router.post(
	"/",
	upload.single("photo"),
	validatePet,
	requireShelterAuth,
	asyncHandler(async (req, res) => {
		console.log("VVVV", req);
		if (req.user === undefined) {
			const err = new Error("Unauthorized");
			err.status = 401;
			err.message = "You must be logged in to do that.";
			err.title = "Unauthorized";
			throw err;
		}
		const shelterId = req.user.id;
		const {
			breedId,
			petName,
			age,
			sex,
			size,
			description,
			photo,
			isOkayPets,
			isOkayKids,
		} = req.body;
		const isFile = _.get(req, "file.path", "");
		const formatUrlFile = isFile ? `http://localhost:8080/${isFile}` : photo;
		console.log("IMAGRe", photo);
		console.log("ISFILE", isFile);
		const pet = await Pet.create({
			breedId,
			petName,
			age,
			sex,
			size,
			description,
			photo: formatUrlFile,
			isAdopted: false,
			isOkayPets,
			isOkayKids,
			shelterId,
		});
		res.json({ pet });
	})
);

router.put(
	"/:id",
	handleValidationErrors,
	requireShelterAuth,
	asyncHandler(async (req, res, next) => {
		const pet = await Pet.findOne({
			where: {
				id: req.params.id,
			},
		});

		// if (req.user.id !== pet.shelterId) {
		// 	const err = new Error("Unauthorized");
		// 	err.status = 401;
		// 	err.message = "You are not authorized to edit this pet's information.";
		// 	err.title = "Unauthorized";
		// 	throw err;
		// }
		if (pet) {
			await pet.update({
				petName: req.body.petName,
				breedId: req.body.breedId,
				age: req.body.age,
				size: req.body.size,
				description: req.body.description,
				photo: req.body.photo,
				isOkayKids: req.body.isOkayKids,
				isOkayPets: req.body.isOkayPets,
				isAdopted: req.body.isAdopted,
			});
			res.json({ pet });
		} else {
			next(petNotFoundError(req.params.id));
		}
	})
);

router.delete(
	"/:id",
	requireShelterAuth,
	asyncHandler(async (req, res, next) => {
		// const { id } = req.body;
		const id = req.params.id;
		console.log("bakkkkkk", id);
		const pet = await Pet.findOne({
			where: {
				// id: req.params.id,
				id,
			},
		});
		// if (req.user.id !== pet.shelterId) {
		// 	const err = new Error("Unauthorized");
		// 	err.status = 401;
		// 	err.message = "You are not authorized to delete this pet.";
		// 	err.title = "Unauthorized";
		// 	throw err;
		// }
		if (pet) {
			await pet.destroy();
			res.json({ message: `Deleted pet with id of ${req.params.id}.`, pet });
		} else {
			next(petNotFoundError(req.params.id));
		}
	})
);

module.exports = router;
