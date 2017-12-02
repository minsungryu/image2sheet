import fs from 'fs'
import path from 'path'
import ExifImage from 'exif'
import program from 'commander'
import child_process from "child_process"

program
.version('0.1.0')
.usage('-s <source_directory> -o <output_file>')
.option('-s, --src <directory>', 'source directory')
.option('-o, --output <file>', 'csv output file')
.parse(process.argv)

if (!(program.src && program.output)) {
  program.help()
}

let pending = 0
let csvData = '\n,,,,,Latitude,Longitude,Date,,Directory\n'
const image_filenames = traversal(path.resolve(program.src))
const start_dir = program.src.split('/').slice(-1)[0]

image_filenames.forEach(filename => {
  extractImageData(filename)
  .then(([timestamp, lat, long]) => {
    const filepath_arr = filename.split('/')
    const index_of_start = filepath_arr.indexOf(start_dir)
    const sliced_filepath = filepath_arr.slice(index_of_start).join('","')
    csvData += `,,,,,"${lat}","${long}",${timestamp},,"${sliced_filepath}"\n`
    pending -= 1
    if (pending === 0) {
      fs.writeFileSync(path.resolve(program.output), csvData, 'utf8')
    }
  })
  .catch(console.error)
})

function traversal(dir) {
  let ret = []
  const filenames = fs.readdirSync(dir)
  filenames.forEach(filename => {
    const pathString = path.join(dir, filename)
    const stats = fs.statSync(pathString)
   
    if (stats.isDirectory()) {
      ret.push(...traversal(pathString))
    } else if (stats.isFile()) {
      ret.push(pathString)
    }
  })
  return ret
}

function extractImageData(filename) {
  return new Promise((resolve, reject) => {
    if (/.+\.jpe?g/gi.test(filename.split('/').slice(-1))) {
      pending += 1
      new ExifImage({ image: filename }, function (error, exifData) {
        if (error) {
          resolve(['시간정보없음', '위치정보없음', '위치정보없음'])
        } 
    
        const { gps, CreateDate, image, exif } = exifData || {}
        const { GPSLatitude, GPSLatitudeRef, GPSLongitude, GPSLongitudeRef, GPSDateStamp, GPSTimeStamp } = gps || {}
        
        const createdAt = (CreateDate || image && image.CreateDate || exif && exif.CreateDate || GPSDateStamp && GPSDateStamp + ' ' + (GPSTimeStamp && GPSTimeStamp.join(':'))) || '시간정보없음'
        const lat = (GPSLatitude && toDecimalDegrees(GPSLatitudeRef, GPSLatitude)) || '위치정보없음'
        const long = (GPSLongitude && toDecimalDegrees(GPSLongitudeRef, GPSLongitude)) || '위치정보없음'
        resolve([createdAt, lat, long])
      })
    }
  })
}

function toDecimalDegrees(ref, [d, m, s]) {
  ref = ref === 'S' || ref === 'W' ? '-' : ''
  return (ref + (d + (m / 60) + (s / 3600)))
}