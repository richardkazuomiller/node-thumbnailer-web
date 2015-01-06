var ThumbnailerWeb = function(options){
  this.tmpDir = options && options.tmpDir;
  if(!this.tmpDir){
    throw new Error('Please set options.tmpDir so we can stage downloads.');
  }
  this.thumbnailer = new ThumbnailerWeb.Thumbnailer({
    sharp : options && options.sharp
  });
}

ThumbnailerWeb.create = function(options){
  return new ThumbnailerWeb(options);
}

ThumbnailerWeb.request = require('request');
ThumbnailerWeb.fs = require('fs');
ThumbnailerWeb.Thumbnailer = require('node-thumbnailer');

ThumbnailerWeb.prototype.downloadSourceImage = function(getOptions,callback){
  var request = ThumbnailerWeb.request;
  var fs = ThumbnailerWeb.fs;
  var req;
  var done = function(err,sourceImagePath){
    done = function(){};
    callback(err,sourceImagePath);
  }
  var filename = String(Math.round(Math.random()*10000000000));
  var sourceImagePath = [this.tmpDir,filename].join('/').split('/').filter(function(val,index){
    return !!val || index == 0;
  }).join('/')
  if(typeof getOptions == 'string'){
    req = request.get(getOptions);
  }
  else{
    req = request(getOptions);
  }
  var outStream = fs.createWriteStream(sourceImagePath);
  req.pipe(outStream);
  req.on('error',function(err){
    done(err);
  })
  outStream.on('close',function(){
    done(null,sourceImagePath);
  })
}

ThumbnailerWeb.prototype.uploadThumbnail = function(thumbnailPath,postOptions,callback){
  var request = ThumbnailerWeb.request;
  var fs = ThumbnailerWeb.fs;
  var req;
  var done = function(err){
    done = function(){};
    if(!err){
      callback(null)
      fs.unlink(thumbnailPath,function(){
      })
    }
    else{
      callback(err);
    }
  }
  if(typeof postOptions == 'string'){
    postOptions = {
      url : postOptions,
      method : 'PUT',
      headers : {}
    }
  }
  postOptions.headers = postOptions.headers || {}
  fs.stat(thumbnailPath,function(err,stats){
    postOptions.headers['content-length'] = stats.size
    req = request(postOptions);
    var inStream = fs.createReadStream(thumbnailPath)
    inStream.pipe(req)
    req.on('error',function(err){
      done(err)
    })
    req.on('response', function(res) {
      if(res.statusCode == 200){
        req.on('end',function(){
          done()
        })
      }
      else{
        req.on('end',function(){
          done(new Error('Status was not 200'))
        })
      }
    })
  })
}

ThumbnailerWeb.prototype.run = function(thumbnailerFunc,args){
  var getOptions = args[0]
  var postOptions = args[args.length-2]
  var callback = args[args.length-1]
  var fs = ThumbnailerWeb.fs;
  var self = this;
  this.downloadSourceImage(getOptions,function(err,sourceImagePath){
    if(err){
      callback(err);
    }
    else{
      var filename = String(Math.round(Math.random()*10000000000))+'.jpg';
      var thumbnailPath = [self.tmpDir,filename].join('/').split('/').filter(function(val,index){
        return !!val || index == 0;
      }).join('/')
      var thumbnailerArgs = []
      thumbnailerArgs.push(sourceImagePath)
      for(var i = 1; i < args.length-2; i++){
        thumbnailerArgs.push(args[i])
      }
      thumbnailerArgs.push(thumbnailPath)
      thumbnailerArgs.push(function(){
        self.uploadThumbnail(thumbnailPath,postOptions,function(err){
          fs.unlink(sourceImagePath,function(){
          })
          callback(err)
        })
      })
      thumbnailerFunc.apply(self.thumbnailer,thumbnailerArgs)
    }
  })
}

ThumbnailerWeb.prototype.resize = function(){
  this.run(this.thumbnailer.resize,arguments)
}

ThumbnailerWeb.prototype.crop = function(){
  this.run(this.thumbnailer.crop,arguments)
}

ThumbnailerWeb.prototype.cropMiddleSquare = function(){
  this.run(this.thumbnailer.cropMiddleSquare,arguments)
}

module.exports = ThumbnailerWeb