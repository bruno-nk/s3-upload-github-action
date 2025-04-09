const aws = require("aws-sdk");
const fs = require("fs");
const path = require("path");

// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html
const s3 = new aws.S3({
  endpoint: new aws.Endpoint(process.env.S3_ENDPOINT),
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  signatureVersion: 'v4'
});

const s3Path = process.env.S3_PATH;
const s3Acl = process.env.S3_ACL;
const s3Bucket = process.env.S3_BUCKET;
const contentType = process.env.CONTENT_TYPE;

var isUploading = false;

const sleep = (waitTimeInMs) => new Promise(resolve => setTimeout(resolve, waitTimeInMs));

const formatBytes = (bytes, decimals = 2) => { // https://stackoverflow.com/a/18650828/8542678
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

const uploadFile = async (fileName) => {
  if (fileName.includes("*.")) {
    let files = fs.readdirSync(".");
    let filePatterns = fileName.split(",");
    filePatterns.forEach(filePattern => {
      let regex = new RegExp(filePattern.replace('*.', '.*\\.') + '$');
      files.forEach(file => {
        if (regex.test(file)) {
          uploadFile(file);
        }
      });
    });
  }
  else if (fs.lstatSync(fileName).isDirectory()) {
    fs.readdirSync(fileName).forEach((file) => {
      uploadFile(`${fileName}/${file}`);
    });
  }
  else {
    let fileContent = fs.readFileSync(fileName);

    let s3Key = `${path.normalize(fileName)}`;    
    if (s3Path) {
      s3Key = `${s3Path}${s3Key}`;
    }

    let params = {
      Bucket: s3Bucket,
      Key: s3Key,
      Body: fileContent,
    };
    
    if (s3Acl) {
      params.ACL = s3Acl;
    }
    
    if (contentType) {
      params.ContentType = contentType;
    }

    while (isUploading) {
      await sleep(100);
      if (process.exitCode > 0) {
        return;
      }
    }

    isUploading = true;

    console.log(`\nUploading: ${fileName} \n\t Size: ${formatBytes(fileContent.length, decimals = 1)} \n\t to: s3://${s3Bucket}/${s3Key}`);

    try {
      let data = await s3.upload(params).promise();
      console.log(`Completed: ${data.Location}`);
      isUploading = false;
    }
    catch (err) {
      console.log(`FAILED!\n${err}`);
      process.exit(1);
    }
  }
};

uploadFile(process.env.FILE);
