import multer from 'multer'

class MulterWrapper {
  constructor(
    fileSizeLimit = undefined,
    allowedMimetypes = [],
    storageType = 'disk' // 'disk' or 'memory'
  ) {
    let storageEngine

    if (storageType === 'disk') {
      storageEngine = multer.diskStorage
    } else if (storageType === 'memory') {
      storageEngine = multer.memoryStorage
    } else {
      throw new Error(
        'Invalid storage type. Supported types are "disk" and "memory".'
      )
    }

    this.upload = multer({
      storage: storageEngine({
        filename: (_, file, cb) => {
          cb(null, file.originalname)
        },
      }),
      limits: {
        fileSize: fileSizeLimit,
      },
      fileFilter: (req, file, cb) => {
        if (allowedMimetypes.includes(file.mimetype)) {
          cb(null, true)
        } else {
          cb(new Error(`MIME type ${file.mimetype} not allowed`))
        }
      },
    })
  }

  single(fieldName) {
    return (req, res, next) => {
      this.upload.single(fieldName)(req, res, (err) => {
        if (err) {
          this._handleUploadError(err, res)
        } else {
          next()
        }
      })
    }
  }

  _handleUploadError(err, res) {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ error: err.message })
    } else if (err.message && err.message.startsWith('MIME')) {
      return res.status(422).json({ error: err.message })
    } else {
      return res.status(500).json({ error: 'Internal Server Error' })
    }
  }
}

export default MulterWrapper
