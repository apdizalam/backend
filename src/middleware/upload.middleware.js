const multer = require('multer');

// Use memory storage to process the file binary as a Buffer and convert it directly to Base64
const storage = multer.memoryStorage();

const upload = multer({ 
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5 MB limit
    },
    fileFilter(req, file, cb) {
        if (!file.originalname.match(/\.(jpg|jpeg|png)$/)) {
            return cb(new Error('Fadlan soo geli sawir sax ah (jpg, jpeg, ama png)'));
        }
        cb(undefined, true);
    }
});

module.exports = upload;
