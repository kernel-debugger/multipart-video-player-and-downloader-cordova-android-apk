class Segment{

	constructor(url, start, end, id, dwnldr){
		this.start = start;
		this.end = end;
		this.url = url;
		this.id = id;
		this.dwnldr = dwnldr;
		console.log("fetching segment: "+id);
		this.downloadSegment();
	}
}
Segment.prototype.downloadSegment =  function(){

	if(this.start>this.end){
		this.response = new Blob();
		this.reqId = 1;
		this.dwnldr.segComplete(this);
		return 0;
	}

	this.reqId = cordova.plugin.http.sendRequest(this.url, {

		method:"get",
		responseType:"blob",
		headers:{
			"Range": "bytes="+this.start+"-"+this.end
		}},

		function(resp){
			console.log("Seg loaded :", this.id);
				this.response = resp.data;
				this.dwnldr.segComplete(this); 
		}.bind(this),

		function(resp){
			if(resp.status && resp.status>500){
				console.log(resp);
				this.dwnldr.stopDownload("Download failed. Server error.")
			}
			else if(resp.status && resp.status == -8){
				console.log("aborted req:",this.reqId)
			}
			else{
				setTimeout(function(){
					if(this.dwnldr.status==1){
						console.log("retrying segment ", this.id,resp)
						this.downloadSegment();
					}
				}.bind(this),5000);
			}

		}.bind(this)
	);
}

class FileDownloader{

	constructor(opts){

		this.url = opts.url || false;
		this.enablePreview = opts.preview || false
		this.segSize = Math.ceil(1024*1024*(opts.segSize || 1));
		this.parallelSegs = opts.parallelSegs || 10;
		this.sizeEl = opts.sizeEl || false;
		this.blockSizePreview = opts.blockSizePreview || false;

		this.segs_total = 0;
		this.segs_downloaded = [];
		this.fsize = 0;
		this.cursor = {start:0, end:-1};
		this.segs_created=0;
		this.current_segs = [];
		this.segs_joined_blob = new Blob();
		this.segs_joined = 0;
		this.segs_previewed = 0;
		this.status = 0;
		this.mime = "unknown"
	}

	getSize(){
		return new Promise(res=>{
			cordova.plugin.http.sendRequest(this.url, {method:"head"}, response => {
			  let fsize = response.headers["content-length"] || 0;
			  this.mime = response.headers["content-type"] || "application/octet-stream"
			  res(fsize*1);
			}, response => {
				console.log(response);
			  res(-1);
			});
		})
	}
	startDownload(){
		this.getSize().then(size=>{
			if(size>0){
				this.sizeEl && (this.sizeEl.innerHTML = (size/(1024*1024)).toFixed(1) + " MB")
				this.fsize = size;
				this.status = 1;
				this.segs_total = Math.ceil(size/this.segSize);
				for(let i=0;i<this.parallelSegs;i++){
					this.createSegment();
				}
			}
			else{
				let a = size==0? "Un-supported URL." : "Network Error.";
				this.status = 3
				this.stopDownload(a);
			}
		})
	}

	createSegment(){
		this.cursor.start = this.cursor.end+1;
		this.cursor.end = this.cursor.start + this.segSize;
		if(this.cursor.end>this.fsize)
			this.cursor.end = this.fsize
		this.segs_created++;
		if(this.segs_created<=this.segs_total && this.status==1)
			this.current_segs.push(
				new Segment(this.url, this.cursor.start, this.cursor.end, this.segs_created, this)
			)
	}

	updateProgress(prog){
		this.onprogress && this.onprogress(prog,this.fsize)
	}

	segComplete(segment){

		let sid = this.current_segs.findIndex(cs => cs.id == segment.id)
		this.current_segs.splice(sid,1);

		if(this.status==1){

			this.segs_downloaded.push(segment);
			this.segs_downloaded = this.segs_downloaded.sort((a,b)=> {return a.id-b.id});
			this.joinSegs();
			this.updateProgress((((this.segs_downloaded.length/this.segs_total)*100).toFixed(0))*1);
			if(this.segs_created<this.segs_total)
				this.createSegment()
			else if(this.segs_joined==this.segs_total)
				this.downloadComplete();
		}
	}

	joinSegs(){
		let oj = this.segs_joined;
		this.segs_downloaded.forEach(seg=>{
			if(seg.id - this.segs_joined == 1){
				this.segs_joined_blob = new Blob([this.segs_joined_blob, seg.response], {type:this.mime})
				this.segs_joined++;
			}
		});
		if(oj != this.segs_joined && this.enablePreview){

			let newBlock = this.segs_joined - this.segs_previewed >= this.parallelSegs;
			let shouldPreview = this.blockSizePreview ? newBlock : true;
			if(shouldPreview){
				console.log("previewing segs: ", this.segs_joined)
				this.segs_previewed = this.segs_joined;
				this.onpreview &&  this.onpreview(this.segs_joined_blob);
			}
		}
	}

	downloadComplete(){
		console.log("download finish");
		this.status = 4;
		this.finishCBs("Download Complete, Saving file...")
	}

	stopDownload(msg = "Download Stoped."){
		this.status = 3;
		this.current_segs.forEach(cs=>{
			cordova.plugin.http.abort(cs.reqId,console.log,console.log);
		})
		this.finishCBs(msg);
	}

	finishCBs(msg){

		let fname = this.url.split("/");
		fname = fname[fname.length-1].split("?")[0] || "download";

		this.onfinish && this.onfinish({status:this.status, blob:this.segs_joined_blob, fname});
		this.updateProgress(msg)
	}

}