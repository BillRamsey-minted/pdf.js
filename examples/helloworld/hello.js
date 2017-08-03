'use strict';

// In production, the bundled pdf.js shall be used instead of SystemJS.
Promise.all([System.import('pdfjs/display/api'),
             System.import('pdfjs/display/global'),
             System.import('pdfjs/display/network'),
             System.resolve('pdfjs/worker_loader')])
       .then(function (modules) {
  var api = modules[0], global = modules[1];
  // In production, change this to point to the built `pdf.worker.js` file.
  global.PDFJS.workerSrc = modules[3];

  document.getElementById('upload').addEventListener('dragover', function(event) {
    event.preventDefault();
  });

  document.getElementById('upload').addEventListener('drop', function(event) {
    event.preventDefault(); // you'll probably want this!
    handleFile(event.dataTransfer.files[0]);
  });

  document.querySelectorAll('#upload input')[0].addEventListener('change', function(event) {
    event.preventDefault(); // you'll probably want this!
    handleFile(event.target.files[0]);
  });

  var shipit = function(blob) {
    Evaporate.create({
      /* START EDITS */
      aws_key: 'AKIAJWSYO6YLEFO476JA', // REQUIRED -- set this to your AWS_ACCESS_KEY_ID
      bucket: 'designfileupload', // REQUIRED -- set this to your s3 bucket name
      awsRegion: 'us-east-1', // OPTIONAL -- change this if your bucket is outside us-east-1
      /* END EDITS */
      signerUrl: 'https://minted-local.mntd.net/api/sign_auth',
      awsSignatureVersion: '4',
      computeContentMd5: true,
      cryptoMd5Method: function (data) { return AWS.util.crypto.md5(data, 'base64'); },
      cryptoHexEncodedHash256: function (data) { return AWS.util.crypto.sha256(data, 'hex'); },
      readableStreams: false,
      readableStreamPartMethod: function (file, start, end) {
        return file;
      }
    })
    .then(function(evap) {
      var filename = 'image_' + Math.floor(1000000000*Math.random()) + '.png';
      // reader.result contains the contents of blob as a typed array
      var promise = evap.add({
        name: filename,
        file: blob,
        started: function (f) { console.log('started evap', f); },
        progress: function (p, d) { console.log('progress evap', p); },
        error: function (m) { console.log('error evap:', m); }
      })
      .then((function (requestedName) {
        console.log('Shipped it')
        return function (awsKey) {
          if (awsKey === requestedName) {
            console.log(awsKey, 'successfully uploaded!');
          } else {
            console.log('Did not re-upload', requestedName, 'because it exists as', awsKey);
          }
        }
      })(name)
      );

    });
  }


  var handleFile = function(file, callback) {

    /*
      maybe better?
      https://github.com/mozilla/pdf.js/blob/a9a3396f3d7121a66081279a92cb1fbbd7b20b07/web/app.js#L1841
          var buffer = evt.target.result;
      var uint8Array = new Uint8Array(buffer);
      PDFViewerApplication.open(uint8Array);

    */


    var reader = new FileReader();
    reader.addEventListener("load", function () {
      console.log('loading');
      // Fetch the PDF document from the URL using promises.
      api.getDocument(reader.result).then(function (pdf) {
        // Fetch the page.
        pdf.getPage(1).then(function (thePage) {
          // returns promise that resolves on render.
          var renderCanvasSmall = function(page, desiredWidth, elementId) {
            return new Promise(function (resolve) {
              var viewport = page.getViewport(1);
              var scale = desiredWidth / viewport.width;
              var viewport = page.getViewport(scale);
              // Prepare canvas using PDF page dimensions.
              var canvas = document.getElementById(elementId);
              var context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              // Render PDF page into canvas context.
              var renderContext = {
                canvasContext: context,
                viewport: viewport
              };
              page.render(renderContext).then(function(){
                resolve(canvas);
              })
            });
          }


          var renderCanvasFullScale = function(page, elementId) {
            return new Promise(function (resolve) {
              var viewport = page.getViewport(1);
              // Prepare canvas using PDF page dimensions.
              var canvas = document.getElementById(elementId);
              var context = canvas.getContext('2d');
              canvas.height = viewport.height;
              canvas.width = viewport.width;

              // Render PDF page into canvas context.
              var renderContext = {
                canvasContext: context,
                viewport: viewport
              };
              page.render(renderContext).then(function(){
                resolve(canvas);
              })
            });
          }

          renderCanvasSmall(thePage, 500, 'the-canvas')
            .then(function(canvas) {
              console.log('FINISHED RENDERING Small')
              var dataURL = canvas.toDataURL();
              var el = document.getElementById('repeating-preview');
              el.style.backgroundImage = 'url(' + dataURL + ')';
              console.log('set background');
            });

          renderCanvasSmall(thePage, 2500, 'hidden-canvas')
            .then(function(canvas) {
              console.log('FINISHED RENDERING Large')
              var blob = canvas.toBlob(shipit);
            });

        });
      })
    });

    reader.readAsDataURL(file);
  };

});
