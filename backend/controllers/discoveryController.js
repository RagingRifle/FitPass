const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const logger = require('../lib/logger');
const prisma = require('../config/prisma');
const { logAudit } = require('../utils/auditLogger');
const { getEffectiveHours, isOpenAt } = require('../utils/gymSchedule');

// Helper: Haversine distance calculation in kilometers
function calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * (Math.PI / 180)) *
        Math.cos(lat2 * (Math.PI / 180)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c;
    return Math.round(distance * 10) / 10; // 1 decimal place
}

// Helper: Ensure every registered Gym has an associated GymProfile
async function ensureGymProfilesExist() {
    try {
        const gymsWithoutProfile = await prisma.gym.findMany({
            where: {
                id: { not: 'SYSTEM' },
                discoveryProfile: null
            }
        });

        // Independent per-gym upserts (each targets a distinct gymId) — fire
        // them concurrently instead of awaiting one at a time.
        await Promise.all(gymsWithoutProfile.filter(gym => gym.id !== 'SYSTEM').map(gym => {
            const defaultImages = gym.images && gym.images.length > 0
                ? gym.images
                : ["https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80"];

            return prisma.gymProfile.upsert({
                where: { gymId: gym.id },
                update: {},
                create: {
                    gymId: gym.id,
                    shortDescription: `Premium fitness center located in ${gym.address || 'the heart of the city'}. Equipped with state-of-the-art machines and personal trainers.`,
                    description: `${gym.name} offers top-notch fitness facilities, heavy resistance training, cardio zones, and certified personal trainers to help you achieve your health goals.`,
                    coverImageUrl: defaultImages[0] || "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
                    logoUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=80",
                    ownerName: "FitPass Admin",
                    contactNumber: gym.phone || "+91 9876543210",
                    email: gym.email || `contact@${gym.name.toLowerCase().replace(/\s+/g, '')}.com`,
                    website: `https://${gym.name.toLowerCase().replace(/\s+/g, '')}.fitpass.in`,
                    address: gym.address || "123 Main Street, Central Plaza",
                    city: "Chennai",
                    googleMapsUrl: "https://maps.google.com",
                    latitude: 13.0827 + (Math.random() - 0.5) * 0.1,
                    longitude: 80.2707 + (Math.random() - 0.5) * 0.1,
                    landmarks: ["Near Metro Station", "City Center Mall"],
                    openingTime: "06:00 AM",
                    closingTime: "10:00 PM",
                    workingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                    hasParking: true,
                    hasLockers: true,
                    hasShowers: true,
                    hasPersonalTraining: true,
                    hasGroupClasses: true,
                    isWomenFriendly: true,
                    isAc: true,
                    amenities: ["Free WiFi", "Locker Room", "Air Conditioned", "Showers", "Steam Bath"],
                    equipments: ["Treadmills", "Dumbbells", "Power Racks", "Cable Crossover", "Leg Press"],
                    status: "Approved",
                    isVerified: true,
                    rating: 4.7 + Math.round(Math.random() * 3) / 10,
                    reviewCount: 15 + Math.floor(Math.random() * 50),
                    viewCount: 120 + Math.floor(Math.random() * 200)
                }
            });
        }));
    } catch (err) {
        logger.error({ err }, 'Error in ensureGymProfilesExist');
    }
}

// @desc    Get all public approved partner gyms with search, filter, recommendations, and distance
// @route   GET /api/v1/discovery/gyms
// @access  Public / Member
const getPublicGyms = catchAsync(async (req, res, next) => {
    await ensureGymProfilesExist();

    const {
        search,
        city,
        amenities,
        equipment,
        isWomenFriendly,
        hasParking,
        hasLockers,
        hasShowers,
        hasPersonalTraining,
        hasGroupClasses,
        isAc,
        openNow,
        lat,
        lng,
        maxDistance,
        sortBy,
        category
    } = req.query;

    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    const discoveryProfileWhere = {
        status: "Approved"
    };

    if (city) {
        discoveryProfileWhere.city = { contains: city, mode: 'insensitive' };
    }

    if (isWomenFriendly === 'true') discoveryProfileWhere.isWomenFriendly = true;
    if (hasParking === 'true') discoveryProfileWhere.hasParking = true;
    if (hasLockers === 'true') discoveryProfileWhere.hasLockers = true;
    if (hasShowers === 'true') discoveryProfileWhere.hasShowers = true;
    if (hasPersonalTraining === 'true') discoveryProfileWhere.hasPersonalTraining = true;
    if (hasGroupClasses === 'true') discoveryProfileWhere.hasGroupClasses = true;
    if (isAc === 'true') discoveryProfileWhere.isAc = true;

    // Build base query
    const where = {
        status: "Active",
        id: { not: "SYSTEM" },
        discoveryProfile: {
            is: discoveryProfileWhere
        }
    };

    if (search) {
        where.OR = [
            { name: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            { discoveryProfile: { is: { city: { contains: search, mode: 'insensitive' } } } },
            { discoveryProfile: { is: { shortDescription: { contains: search, mode: 'insensitive' } } } }
        ];
    }

    // Fetch real total check-ins aggregated from SessionCheckIn
    const checkInMap = {};
    try {
        const checkInCounts = await prisma.sessionCheckIn.groupBy({
            by: ['gymId'],
            where: { gymId: { not: null } },
            _count: { id: true }
        });
        checkInCounts.forEach(c => {
            if (c.gymId) checkInMap[c.gymId] = c._count.id;
        });
    } catch (err) {
        logger.error({ err }, 'Error fetching checkInCounts');
    }

    const gyms = await prisma.gym.findMany({
        where,
        include: {
            discoveryProfile: true
        }
    });

    let results = gyms.map(gym => {
        const profile = gym.discoveryProfile || {};
        const distance = userLat && userLng && profile.latitude && profile.longitude
            ? calculateDistance(userLat, userLng, profile.latitude, profile.longitude)
            : null;

        const isOpen = isOpenAt(profile);
        const totalVisits = (checkInMap[gym.id] || 0) + (profile.viewCount || 0);

        return {
            id: gym.id,
            name: gym.name,
            address: gym.address || profile.address,
            phone: gym.phone || profile.contactNumber,
            email: gym.email || profile.email,
            status: gym.status,
            discoveryProfile: {
                ...profile,
                isOpenNow: isOpen,
                todayHours: getEffectiveHours(profile),
                distanceKm: distance,
                totalVisits: totalVisits
            }
        };
    });

    // Filtering by amenity / equipment arrays
    if (amenities) {
        const requiredAmenities = amenities.split(',').map(a => a.trim().toLowerCase());
        results = results.filter(g => {
            const gymAmenities = (g.discoveryProfile.amenities || []).map(a => a.toLowerCase());
            return requiredAmenities.every(reqA => gymAmenities.some(ga => ga.includes(reqA)));
        });
    }

    if (equipment) {
        const reqEq = equipment.trim().toLowerCase();
        results = results.filter(g => {
            const gymEq = (g.discoveryProfile.equipments || []).map(e => e.toLowerCase());
            return gymEq.some(eq => eq.includes(reqEq));
        });
    }

    if (openNow === 'true') {
        results = results.filter(g => g.discoveryProfile.isOpenNow);
    }

    if (maxDistance && userLat && userLng) {
        const maxDist = parseFloat(maxDistance);
        results = results.filter(g => g.discoveryProfile.distanceKm !== null && g.discoveryProfile.distanceKm <= maxDist);
    }

    // Category sorting and filtering
    if (category) {
        switch (category) {
            case 'nearby':
                if (userLat && userLng) {
                    results.sort((a, b) => (a.discoveryProfile.distanceKm || 999) - (b.discoveryProfile.distanceKm || 999));
                }
                break;
            case 'recommended':
                results.sort((a, b) => (b.discoveryProfile.rating || 0) - (a.discoveryProfile.rating || 0));
                break;
            case 'trending':
                results.sort((a, b) => (b.discoveryProfile.totalVisits || 0) - (a.discoveryProfile.totalVisits || 0));
                break;
            case 'newly_added':
                results.sort((a, b) => new Date(b.discoveryProfile.createdAt).getTime() - new Date(a.discoveryProfile.createdAt).getTime());
                break;
            case 'highest_rated':
                results.sort((a, b) => (b.discoveryProfile.rating || 0) - (a.discoveryProfile.rating || 0));
                break;
            case 'most_visited':
                results.sort((a, b) => (b.discoveryProfile.totalVisits || 0) - (a.discoveryProfile.totalVisits || 0));
                break;
            case 'open_now':
                results = results.filter(g => g.discoveryProfile.isOpenNow);
                break;
            default:
                break;
        }
    } else if (sortBy) {
        switch (sortBy) {
            case 'nearest':
                results.sort((a, b) => (a.discoveryProfile.distanceKm || 999) - (b.discoveryProfile.distanceKm || 999));
                break;
            case 'popular':
            case 'most_visited':
                results.sort((a, b) => (b.discoveryProfile.totalVisits || 0) - (a.discoveryProfile.totalVisits || 0));
                break;
            case 'newest':
                results.sort((a, b) => new Date(b.discoveryProfile.createdAt).getTime() - new Date(a.discoveryProfile.createdAt).getTime());
                break;
            case 'highest_rated':
                results.sort((a, b) => (b.discoveryProfile.rating || 0) - (a.discoveryProfile.rating || 0));
                break;
            case 'alphabetical':
                results.sort((a, b) => a.name.localeCompare(b.name));
                break;
        }
    }

    res.status(200).json({
        success: true,
        data: results,
        meta: {
            total: results.length,
            userLocation: userLat && userLng ? { latitude: userLat, longitude: userLng } : null
        }
    });
});

// @desc    Get detailed public gym profile + latest approved posts + view count bump
// @route   GET /api/v1/discovery/gyms/:gymId
// @access  Public / Member
const getPublicGymDetails = catchAsync(async (req, res, next) => {
    const { gymId } = req.params;
    const { lat, lng } = req.query;

    const gym = await prisma.gym.findUnique({
        where: { id: gymId },
        include: {
            discoveryProfile: true,
            posts: {
                where: { status: 'Approved' },
                orderBy: { createdAt: 'desc' },
                take: 10
            }
        }
    });

    if (!gym) {
        return next(new AppError('Partner Gym not found', 404));
    }

    // Increment profile view count asynchronously
    if (gym.discoveryProfile) {
        prisma.gymProfile.update({
            where: { id: gym.discoveryProfile.id },
            data: { viewCount: { increment: 1 } }
        }).catch(() => {});

        prisma.gymProfileViewLog.create({
            data: {
                gymId: gymId,
                memberId: req.user?.id || null,
                source: req.query.source || 'explore'
            }
        }).catch(() => {});
    }

    const profile = gym.discoveryProfile || {};
    const userLat = lat ? parseFloat(lat) : null;
    const userLng = lng ? parseFloat(lng) : null;

    const distance = userLat && userLng && profile.latitude && profile.longitude
        ? calculateDistance(userLat, userLng, profile.latitude, profile.longitude)
        : null;

    const isOpen = isOpenAt(profile);

    // Get real total check-ins count
    const totalCheckIns = await prisma.sessionCheckIn.count({
        where: { gymId: gymId }
    });

    res.status(200).json({
        success: true,
        data: {
            id: gym.id,
            name: gym.name,
            address: gym.address,
            phone: gym.phone,
            email: gym.email,
            discoveryProfile: {
                ...profile,
                isOpenNow: isOpen,
                todayHours: getEffectiveHours(profile),
                distanceKm: distance,
                totalCheckIns: totalCheckIns
            },
            posts: gym.posts || []
        }
    });
});

// @desc    Get public approved social posts feed
// @route   GET /api/v1/discovery/posts
// @access  Public / Member
const getPublicPostsFeed = catchAsync(async (req, res, next) => {
    const posts = await prisma.gymPost.findMany({
        where: { status: 'Approved' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: {
            gym: {
                select: {
                    id: true,
                    name: true,
                    discoveryProfile: {
                        select: {
                            logoUrl: true,
                            coverImageUrl: true,
                            city: true,
                            isVerified: true
                        }
                    }
                }
            }
        }
    });

    res.status(200).json({
        success: true,
        data: posts,
        meta: { total: posts.length }
    });
});

// @desc    Get current gym's own discovery profile (Partner Gym Admin)
// @route   GET /api/v1/discovery/my-profile
// @access  Private (Gym Admin)
const getMyGymProfile = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId;
    if (!gymId || gymId === 'SYSTEM') {
        return next(new AppError('User is not associated with a valid partner gym', 403));
    }

    let profile = await prisma.gymProfile.findUnique({
        where: { gymId }
    });

    if (!profile) {
        const gym = await prisma.gym.findUnique({ where: { id: gymId } });
        if (!gym) return next(new AppError('Gym not found', 404));

        profile = await prisma.gymProfile.create({
            data: {
                gymId,
                shortDescription: `Welcome to ${gym.name}! Premium equipment and expert trainers.`,
                description: `${gym.name} offers state-of-the-art gym equipment, group classes, and personal training options.`,
                coverImageUrl: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&auto=format&fit=crop&q=80",
                logoUrl: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=150&auto=format&fit=crop&q=80",
                ownerName: req.user.name || "Gym Owner",
                contactNumber: gym.phone || "+91 9876543210",
                email: gym.email || req.user.email,
                address: gym.address || "123 Main Street",
                city: "Chennai",
                status: "Pending Review"
            }
        });
    }

    res.status(200).json({
        success: true,
        data: profile
    });
});

// @desc    Update & submit gym's discovery profile
// @route   PUT /api/v1/discovery/my-profile
// @access  Private (Gym Admin)
const updateMyGymProfile = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId;
    if (!gymId || gymId === 'SYSTEM') {
        return next(new AppError('User is not associated with a valid partner gym', 403));
    }

    const {
        name,
        defaultSessionDurationMinutes,
        shortDescription,
        description,
        coverImageUrl,
        logoUrl,
        ownerName,
        contactNumber,
        email,
        website,
        address,
        city,
        googleMapsUrl,
        latitude,
        longitude,
        landmarks,
        openingTime,
        closingTime,
        workingDays,
        timeZone,
        weeklySchedule,
        scheduleExceptions,
        hasParking,
        hasLockers,
        hasShowers,
        hasPersonalTraining,
        hasGroupClasses,
        isWomenFriendly,
        isAc,
        amenities,
        equipments,
        instagram,
        facebook,
        youtube
    } = req.body;

    const isSuperAdmin = req.user.role === 'superadmin' || req.user.role === 'fitpass_admin';

    const updateData = {
        shortDescription,
        description,
        coverImageUrl,
        logoUrl,
        ownerName,
        contactNumber,
        email,
        website,
        address,
        city,
        googleMapsUrl,
        latitude: latitude === undefined ? undefined : (latitude === null || latitude === '' ? null : parseFloat(latitude)),
        longitude: longitude === undefined ? undefined : (longitude === null || longitude === '' ? null : parseFloat(longitude)),
        landmarks: Array.isArray(landmarks) ? landmarks : undefined,
        openingTime,
        closingTime,
        workingDays: Array.isArray(workingDays) ? workingDays : undefined,
        timeZone,
        weeklySchedule: weeklySchedule && typeof weeklySchedule === 'object' ? weeklySchedule : undefined,
        scheduleExceptions: Array.isArray(scheduleExceptions) ? scheduleExceptions : undefined,
        hasParking: hasParking !== undefined ? Boolean(hasParking) : undefined,
        hasLockers: hasLockers !== undefined ? Boolean(hasLockers) : undefined,
        hasShowers: hasShowers !== undefined ? Boolean(hasShowers) : undefined,
        hasPersonalTraining: hasPersonalTraining !== undefined ? Boolean(hasPersonalTraining) : undefined,
        hasGroupClasses: hasGroupClasses !== undefined ? Boolean(hasGroupClasses) : undefined,
        isWomenFriendly: isWomenFriendly !== undefined ? Boolean(isWomenFriendly) : undefined,
        isAc: isAc !== undefined ? Boolean(isAc) : undefined,
        amenities: Array.isArray(amenities) ? amenities : undefined,
        equipments: Array.isArray(equipments) ? equipments : undefined,
        instagram,
        facebook,
        youtube,
        // Operating hours and contact details must take effect immediately.
        // Keep an already-approved profile visible while the partner edits it.
        status: isSuperAdmin ? (req.body.status || "Approved") : "Approved",
        rejectionReason: isSuperAdmin ? req.body.rejectionReason : ""
    };

    // Clean undefined fields
    Object.keys(updateData).forEach(key => updateData[key] === undefined && delete updateData[key]);

    const profile = await prisma.gymProfile.upsert({
        where: { gymId },
        update: updateData,
        create: { gymId, ...updateData }
    });

    const gymData = {};
    if (name !== undefined) gymData.name = String(name).trim();
    if (address !== undefined) gymData.address = address;
    if (contactNumber !== undefined) gymData.phone = contactNumber;
    if (email !== undefined) gymData.email = email;
    if (latitude !== undefined) gymData.latitude = latitude === null || latitude === '' ? null : Number(latitude);
    if (longitude !== undefined) gymData.longitude = longitude === null || longitude === '' ? null : Number(longitude);
    if (defaultSessionDurationMinutes !== undefined && Number.isInteger(Number(defaultSessionDurationMinutes)) && Number(defaultSessionDurationMinutes) >= 15) {
        gymData.defaultSessionDurationMinutes = Number(defaultSessionDurationMinutes);
    }
    if (Object.keys(gymData).length) {
        await prisma.gym.update({ where: { id: gymId }, data: gymData });
    }

    await logAudit(req, 'GYM_PROFILE_UPDATED', 'GymProfile', profile.id, `Updated gym Explore profile, contact details, or operating schedule`);

    res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: profile
    });
});

const uploadGymProfileImage = catchAsync(async (req, res, next) => {
    const gymId = req.params.gymId || req.user.gymId;
    const field = req.body.field;
    if (!req.file?.path) return next(new AppError('Choose an image to upload.', 400));
    if (!['coverImageUrl', 'logoUrl'].includes(field)) return next(new AppError('Image must be a cover or logo.', 400));
    if (!gymId || gymId === 'SYSTEM') return next(new AppError('A partner gym must be selected.', 400));
    if (req.user.role === 'admin' && String(req.user.gymId) !== String(gymId)) {
        return next(new AppError('You can only edit your own gym profile.', 403));
    }
    const gym = await prisma.gym.findUnique({ where: { id: gymId } });
    if (!gym) return next(new AppError('Gym not found.', 404));
    const profile = await prisma.gymProfile.upsert({
        where: { gymId },
        create: { gymId, [field]: req.file.path },
        update: { [field]: req.file.path },
    });
    await logAudit(req, 'GYM_PROFILE_IMAGE_UPDATED', 'GymProfile', profile.id, `Updated gym ${field === 'coverImageUrl' ? 'cover image' : 'logo'}`);
    res.json({ success: true, field, url: req.file.path, data: profile });
});

// @desc    Get current gym's social posts
// @route   GET /api/v1/discovery/my-posts
// @access  Private (Gym Admin)
const getMyGymPosts = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId;
    if (!gymId || gymId === 'SYSTEM') {
        return next(new AppError('User is not associated with a valid partner gym', 403));
    }

    const posts = await prisma.gymPost.findMany({
        where: { gymId },
        orderBy: { createdAt: 'desc' }
    });

    res.status(200).json({
        success: true,
        data: posts,
        meta: { total: posts.length }
    });
});

// @desc    Create a new social post for partner gym
// @route   POST /api/v1/discovery/my-posts
// @access  Private (Gym Admin)
const createMyGymPost = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId;
    if (!gymId || gymId === 'SYSTEM') {
        return next(new AppError('User is not associated with a valid partner gym', 403));
    }

    const { title, caption, description, images, videoUrl } = req.body;

    if (!title) {
        return next(new AppError('Post title is required', 400));
    }

    if (images && Array.isArray(images) && images.length > 5) {
        return next(new AppError('Maximum 5 images allowed per post', 400));
    }

    const isSuperAdmin = req.user.role === 'superadmin' || req.user.role === 'fitpass_admin';

    const post = await prisma.gymPost.create({
        data: {
            gymId,
            title,
            caption: caption || '',
            description: description || '',
            images: Array.isArray(images) ? images : [],
            videoUrl: videoUrl || '',
            status: isSuperAdmin ? 'Approved' : 'Pending Review',
            createdById: req.user.id,
            createdByName: req.user.name || 'Gym Admin'
        }
    });

    await logAudit(req, 'GYM_POST_CREATED', 'GymPost', post.id, `Created social post: ${title}`);

    res.status(201).json({
        success: true,
        message: isSuperAdmin ? 'Post created & approved' : 'Post submitted for FitPass Admin review',
        data: post
    });
});

// @desc    Update/Resubmit an existing social post
// @route   PUT /api/v1/discovery/my-posts/:postId
// @access  Private (Gym Admin)
const updateMyGymPost = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId;
    const { postId } = req.params;

    const existingPost = await prisma.gymPost.findUnique({ where: { id: postId } });
    if (!existingPost) {
        return next(new AppError('Post not found', 404));
    }

    if (existingPost.gymId !== gymId && req.user.role !== 'superadmin') {
        return next(new AppError('Not authorized to edit this post', 403));
    }

    const { title, caption, description, images, videoUrl } = req.body;

    if (images && Array.isArray(images) && images.length > 5) {
        return next(new AppError('Maximum 5 images allowed per post', 400));
    }

    const isSuperAdmin = req.user.role === 'superadmin' || req.user.role === 'fitpass_admin';

    const updatedPost = await prisma.gymPost.update({
        where: { id: postId },
        data: {
            title: title || existingPost.title,
            caption: caption !== undefined ? caption : existingPost.caption,
            description: description !== undefined ? description : existingPost.description,
            images: Array.isArray(images) ? images : existingPost.images,
            videoUrl: videoUrl !== undefined ? videoUrl : existingPost.videoUrl,
            status: isSuperAdmin ? (req.body.status || 'Approved') : 'Pending Review',
            rejectionReason: isSuperAdmin ? (req.body.rejectionReason || '') : ''
        }
    });

    res.status(200).json({
        success: true,
        message: isSuperAdmin ? 'Post updated' : 'Post resubmitted for FitPass Admin review',
        data: updatedPost
    });
});

// @desc    Delete a social post
// @route   DELETE /api/v1/discovery/my-posts/:postId
// @access  Private (Gym Admin)
const deleteMyGymPost = catchAsync(async (req, res, next) => {
    const gymId = req.user.gymId;
    const { postId } = req.params;

    const existingPost = await prisma.gymPost.findUnique({ where: { id: postId } });
    if (!existingPost) {
        return next(new AppError('Post not found', 404));
    }

    if (existingPost.gymId !== gymId && req.user.role !== 'superadmin') {
        return next(new AppError('Not authorized to delete this post', 403));
    }

    await prisma.gymPost.delete({ where: { id: postId } });

    res.status(200).json({
        success: true,
        message: 'Post deleted successfully'
    });
});

// @desc    Get admin approval queue (Pending profiles and posts)
// @route   GET /api/v1/discovery/admin/approval-queue
// @access  Private (SuperAdmin / FitPass Admin)
const getAdminApprovalQueue = catchAsync(async (req, res, next) => {
    const pendingProfiles = await prisma.gymProfile.findMany({
        where: { status: 'Pending Review' },
        include: {
            gym: { select: { id: true, name: true, address: true, phone: true, email: true } }
        },
        orderBy: { updatedAt: 'desc' }
    });

    const pendingPosts = await prisma.gymPost.findMany({
        where: { status: 'Pending Review' },
        include: {
            gym: { select: { id: true, name: true } }
        },
        orderBy: { updatedAt: 'desc' }
    });

    res.status(200).json({
        success: true,
        data: {
            profiles: pendingProfiles,
            posts: pendingPosts
        },
        meta: {
            pendingProfilesCount: pendingProfiles.length,
            pendingPostsCount: pendingPosts.length
        }
    });
});

// @desc    Approve or Reject gym profile
// @route   PATCH /api/v1/discovery/admin/profiles/:gymId/status
// @access  Private (SuperAdmin / FitPass Admin)
const reviewProfileStatus = catchAsync(async (req, res, next) => {
    const { gymId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['Approved', 'Rejected', 'Archived', 'Pending Review'].includes(status)) {
        return next(new AppError('Invalid status provided', 400));
    }

    if (status === 'Rejected' && !rejectionReason) {
        return next(new AppError('Rejection reason is required when rejecting a profile', 400));
    }

    const updatedProfile = await prisma.gymProfile.update({
        where: { gymId },
        data: {
            status,
            rejectionReason: status === 'Rejected' ? rejectionReason : ''
        }
    });

    await logAudit(req, `GYM_PROFILE_${status.toUpperCase()}`, 'GymProfile', updatedProfile.id, `Set status to ${status}. Reason: ${rejectionReason || 'N/A'}`);

    res.status(200).json({
        success: true,
        message: `Profile status updated to ${status}`,
        data: updatedProfile
    });
});

// @desc    Approve or Reject gym post
// @route   PATCH /api/v1/discovery/admin/posts/:postId/status
// @access  Private (SuperAdmin / FitPass Admin)
const reviewPostStatus = catchAsync(async (req, res, next) => {
    const { postId } = req.params;
    const { status, rejectionReason } = req.body;

    if (!['Approved', 'Rejected', 'Archived', 'Pending Review'].includes(status)) {
        return next(new AppError('Invalid status provided', 400));
    }

    if (status === 'Rejected' && !rejectionReason) {
        return next(new AppError('Rejection reason is required when rejecting a post', 400));
    }

    const updatedPost = await prisma.gymPost.update({
        where: { id: postId },
        data: {
            status,
            rejectionReason: status === 'Rejected' ? rejectionReason : ''
        }
    });

    await logAudit(req, `GYM_POST_${status.toUpperCase()}`, 'GymPost', updatedPost.id, `Set status to ${status}. Reason: ${rejectionReason || 'N/A'}`);

    res.status(200).json({
        success: true,
        message: `Post status updated to ${status}`,
        data: updatedPost
    });
});

// @desc    Get Discovery System Analytics
// @route   GET /api/v1/discovery/analytics
// @access  Private (SuperAdmin / Gym Admin)
const getDiscoveryAnalytics = catchAsync(async (req, res, next) => {
    const totalProfiles = await prisma.gymProfile.count();
    const approvedProfiles = await prisma.gymProfile.count({ where: { status: 'Approved' } });
    const pendingProfiles = await prisma.gymProfile.count({ where: { status: 'Pending Review' } });
    const totalPosts = await prisma.gymPost.count();
    const approvedPosts = await prisma.gymPost.count({ where: { status: 'Approved' } });
    
    // Top 5 most viewed gym profiles
    const topViewedGyms = await prisma.gymProfile.findMany({
        where: { status: 'Approved' },
        orderBy: { viewCount: 'desc' },
        take: 5,
        include: {
            gym: { select: { id: true, name: true } }
        }
    });

    res.status(200).json({
        success: true,
        data: {
            overview: {
                totalProfiles,
                approvedProfiles,
                pendingProfiles,
                totalPosts,
                approvedPosts
            },
            topViewedGyms
        }
    });
});

module.exports = {
    getPublicGyms,
    getPublicGymDetails,
    getPublicPostsFeed,
    getMyGymProfile,
    updateMyGymProfile,
    uploadGymProfileImage,
    getMyGymPosts,
    createMyGymPost,
    updateMyGymPost,
    deleteMyGymPost,
    getAdminApprovalQueue,
    reviewProfileStatus,
    reviewPostStatus,
    getDiscoveryAnalytics
};
