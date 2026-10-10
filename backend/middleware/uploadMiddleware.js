const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../utils/cloudinary');

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gym_crm/gym_images',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage: storage });

const profileStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'gym_crm/member_profiles',
    allowed_formats: ['jpg', 'jpeg', 'png', 'webp'],
    transformation: [{ width: 640, height: 640, crop: 'limit', quality: 'auto', fetch_format: 'auto' }],
  },
});

const profileImageUpload = multer({
  storage: profileStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      return callback(new Error('Profile pictures must be JPG, PNG, or WebP images.'));
    }
    callback(null, true);
  },
});

module.exports = upload;
module.exports.profileImageUpload = profileImageUpload;
