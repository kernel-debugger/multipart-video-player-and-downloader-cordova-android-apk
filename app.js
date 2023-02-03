const qs = a=>document.querySelector(a);

let btn = qs("#start");
let dlForm = qs("form");
let dl = null;

btn.addEventListener("click",()=>{

	if(~btn.innerHTML.indexOf("Start")){

		if(dlForm.checkValidity()){

			//new Downloader class with callbacks
			let opts = {
				url:qs("#url").value,
				preview:qs("#preview").checked,
				parallelSegs:qs("#segs").value*1,
				segSize:qs("#size").value*1,
				sizeEl:qs("#fsize"),
				blockSizePreview:qs("#bsp").checked
			}
			dl = new FileDownloader(opts);
			dl.onfinish = function(resp){
				btn.innerHTML = "Start Download";
				if(resp.status==4)
					downloadFile(resp.blob, resp.fname)
			}
			dl.onprogress = function(prog,size){
				size = size/(1024*1024)
				qs("#prog").innerHTML = prog + (typeof(prog)=="number"?"%":"");
				if(typeof(prog)=="number")
					qs("#dwsize").innerHTML = (prog*size/100).toFixed(1) + " MB";
			}
			dl.onpreview = function(pblob){
				let vd = document.querySelector("video");
				if(vd){
					let curr = vd.currentTime
					if(vd.src.indexOf("blob")){
						URL.revokeObjectURL(vd.src);
					}
					vd.src = URL.createObjectURL(pblob);
					vd.currentTime = curr;
					vd.play();
				}
			}
			dl.startDownload();

			// app logic
			btn.innerHTML = "Stop Download"
		}
		else{
			dlForm.reportValidity();
		}

	}

	else{
		dl.stopDownload();
	}

});

function downloadFile (blob, fileName) {

  let folder = cordova.file.externalRootDirectory + 'Download'
  window.resolveLocalFileSystemURL(folder, function (dirEntry) {
  console.log('file system open: ' + dirEntry.name)
  fileName = fileName || "download"

  dirEntry.getFile(fileName, { create: true, exclusive: false }, function (fileEntry) {
      fileEntry.createWriter(function (fileWriter) {
        fileWriter.onwriteend = function () {
          qs('#prog').innerHTML= "File saved to storage."
        }
        fileWriter.onerror = function (error) {
           qs('#prog').innerHTML = 'Failed file write: ' + error
        }
        fileWriter.write(blob)
      })
  }, console.log)
  }, console.log)
}

document.addEventListener("deviceready",()=>{

	cordova.plugin.http.setServerTrustMode('nocheck', console.log, console.log);
	//cordova.plugin.http.setConnectTimeout(20);

})