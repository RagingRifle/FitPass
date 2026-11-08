const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const Gym = require('../models/Gym');
const { logAudit } = require('../utils/auditLogger');
const prisma = require('../config/prisma');

// @desc    Upload images for a gym
// @route   POST /api/gyms/images
// @access  Private (Admin)
const uploadGymImages = catchAsync(async (req, res, next) => {
    // Ensure files were uploaded
    if (!req.files || req.files.length === 0) {
        return res.status(400).json({ message: 'No images uploaded' });
    }

    // req.user contains the authenticated user. We expect them to be a gym admin.
    const gymId = req.user.gymId;
    if (!gymId) {
        return res.status(403).json({ message: 'User does not belong to a gym' });
    }

    try {
        const gym = await Gym.findById(gymId);
        if (!gym) {
            return res.status(404).json({ message: 'Gym not found' });
        }

        const existingImagesCount = gym.images ? gym.images.length : 0;
        const newImagesCount = req.files.length;

        if (existingImagesCount + newImagesCount > 4) {
            return res.status(400).json({ 
                message: `Cannot upload more than 4 images. You currently have ${existingImagesCount} images.` 
            });
        }

        const newImageUrls = req.files.map(file => file.path);
        
        // Add new images to the array
        const updatedImages = gym.images ? [...gym.images, ...newImageUrls] : newImageUrls;
        
        // Update gym images
        gym.images = updatedImages;
        await gym.save();

        await logAudit(req, 'GYM_IMAGES_UPLOADED', 'Gym', gymId, `Uploaded ${newImagesCount} new images for gym`);

        res.status(200).json({
            message: 'Images uploaded successfully',
            images: gym.images
        });
    } catch (error) { next(error); }
});

// @desc    Get gym by ID
// @route   GET /api/gyms/:id
// @access  Public
const getGymById = catchAsync(async (req, res, next) => {
    try {
        const { id } = req.params;
        const prisma = require('../config/prisma');
        const gym = await prisma.gym.findUnique({
            where: { id },
            include: { settings: true }
        });
        if (!gym) {
            return res.status(404).json({ message: 'Gym not found' });
        }
        res.status(200).json(gym);
    } catch (error) { next(error); }
});

// @desc    Get all partnered gyms with their images
// @route   GET /api/gyms/partnered
// @access  Public
const getPartneredGyms = catchAsync(async (req, res, next) => {
    try {
        // Find all gyms. In this system, all non-system gyms can be considered partnered.
        const gyms = await Gym.find({ id: { $ne: 'SYSTEM' } }).select('id name address phone email status images latitude longitude defaultSessionDurationMinutes');
        res.status(200).json(gyms);
    } catch (error) { next(error); }
});

// @desc    Update/reorder gym images
// @route   PUT /api/gyms/images
// @access  Private (Admin)
const updateGymImages = catchAsync(async (req, res, next) => {
    const { images } = req.body; // Expecting an array of strings
    
    if (!Array.isArray(images)) {
        return res.status(400).json({ message: 'Images must be an array of URLs' });
    }

    if (images.length > 4) {
        return res.status(400).json({ message: 'Cannot have more than 4 images.' });
    }

    const gymId = req.user.gymId;
    if (!gymId) {
        return res.status(403).json({ message: 'User does not belong to a gym' });
    }

    try {
        const updatedGym = await Gym.findByIdAndUpdate(
            gymId, 
            { $set: { images: images } }
        );

        await logAudit(req, 'GYM_IMAGES_UPDATED', 'Gym', gymId, 'Reordered or deleted gym images');

        res.status(200).json({
            message: 'Images updated successfully',
            images: updatedGym.images
        });
    } catch (error) { next(error); }
});

// @desc    Get gym settings
// @route   GET /api/gyms/settings
// @access  Private (Admin)
const getGymSettings = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId ? req.user.gymId.toString() : null;
    if (!gymId || gymId === 'undefined' || gymId === 'null') return res.status(403).json({ message: 'User does not belong to a gym' });

    try {
        let settings = await prisma.gymSettings.findUnique({ where: { gymId } });
        if (!settings) {
            const gymExists = await prisma.gym.findUnique({ where: { id: gymId } });
            if (!gymExists) {
                return res.status(404).json({ message: `Gym with ID ${gymId} not found in database. Cannot create settings.` });
            }
            settings = await prisma.gymSettings.create({ data: { gymId } });
        }
        res.status(200).json(settings);
    } catch (error) { next(error); }
});

// @desc    Update gym settings
// @route   PUT /api/gyms/settings
// @access  Private (Admin)
const updateGymSettings = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId ? req.user.gymId.toString() : null;
    if (!gymId || gymId === 'undefined' || gymId === 'null') return res.status(403).json({ message: 'User does not belong to a gym' });

    try {
        const gymExists = await prisma.gym.findUnique({ where: { id: gymId } });
        if (!gymExists) {
            return res.status(404).json({ message: `Gym with ID ${gymId} not found in database. Cannot update settings.` });
        }

        const updateData = { ...req.body };
        // Clean out fields we don't want to accidentally upsert like id, gymId, createdAt
        delete updateData.id;
        delete updateData.gymId;
        delete updateData.createdAt;
        delete updateData.updatedAt;

        const settings = await prisma.gymSettings.upsert({
            where: { gymId },
            update: updateData,
            create: { gymId, ...updateData }
        });
        
        await logAudit(req, 'GYM_SETTINGS_UPDATED', 'GymSettings', settings.id, 'Updated gym configuration settings');
        
        res.status(200).json({ message: 'Settings updated successfully', settings });
    } catch (error) { next(error); }
});

// @desc    Get all gyms (for gym profile / operations hub)
// @route   GET /api/gyms
// @access  Private
const getGyms = catchAsync(async (req, res, next) => {
    try {
        const query = {};
        if (req.user && req.user.gymId && req.user.gymId !== 'SYSTEM' && req.user.role !== 'superadmin') {
            query.id = req.user.gymId;
        }
        const gyms = await Gym.find(query);
        res.status(200).json(gyms);
    } catch (error) { next(error); }
});

module.exports = {
    getGyms,
    getGymById,
    uploadGymImages,
    getPartneredGyms,
    updateGymImages,
    getGymSettings,
    updateGymSettings
};

