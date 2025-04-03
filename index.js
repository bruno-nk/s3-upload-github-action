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

    try {
      await s3.upload(params).promise();
      console.log(`Uploaded: ${fileName} \n\tto: s3://${s3Bucket}/${s3Key}`);
      isUploading = false;
    }
    catch (err) {
      console.log(`FAILED Uploading: ${fileName} \n\tto: s3://${s3Bucket}/${s3Key} \n${err}`);
      process.exit(1);
    }
  }
};

uploadFile(process.env.FILE);
