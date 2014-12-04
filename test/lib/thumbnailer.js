var sinon = require('sinon')
var assert = require('power-assert')

describe('lib/thumbnailer_web',function(){
  beforeEach(function(){
    this.ThumbnailerWeb = require('../../lib/thumbnailer_web')
    this.thumbnailerWeb = new this.ThumbnailerWeb({tmpDir:'/tmp'})
  })
  describe('constructor',function(){
    it('should throw an error if we do not set a tmpDir',function(){
      var self = this;
      assert.throws(function(){
        new self.ThumbnailerWeb()
      })
    })
  })
  describe('create',function(){
    it('should create a ThumbnailerWeb',function(){
      var res = this.ThumbnailerWeb.create({tmpDir:'/foobar'})
      assert(res.tmpDir == '/foobar')
      assert(res instanceof this.ThumbnailerWeb)
    })
  })
  describe('resize',function(){
    it('should crop',function(){
      sinon.stub(this.thumbnailerWeb,'run')
      this.thumbnailerWeb.resize('foo','bar')
      assert(this.thumbnailerWeb.run.getCall(0).args[0] 
        == this.thumbnailerWeb.thumbnailer.resize)
      assert(this.thumbnailerWeb.run.getCall(0).args[1][0] == 'foo')
      assert(this.thumbnailerWeb.run.getCall(0).args[1][1] == 'bar')
    })
  })
  describe('crop',function(){
    it('should crop',function(){
      sinon.stub(this.thumbnailerWeb,'run')
      this.thumbnailerWeb.crop('foo','bar')
      assert(this.thumbnailerWeb.run.getCall(0).args[0] 
        == this.thumbnailerWeb.thumbnailer.crop)
      assert(this.thumbnailerWeb.run.getCall(0).args[1][0] == 'foo')
      assert(this.thumbnailerWeb.run.getCall(0).args[1][1] == 'bar')
    })
  })
  describe('cropMiddleSquare',function(){
    it('should crop the middle square!',function(){
      sinon.stub(this.thumbnailerWeb,'run')
      this.thumbnailerWeb.cropMiddleSquare('foo','bar')
      assert(this.thumbnailerWeb.run.getCall(0).args[0] 
        == this.thumbnailerWeb.thumbnailer.cropMiddleSquare)
      assert(this.thumbnailerWeb.run.getCall(0).args[1][0] == 'foo')
      assert(this.thumbnailerWeb.run.getCall(0).args[1][1] == 'bar')
    })
  })
  describe('run',function(){
    it('should callback with an error if it cannot download the image',function(){
      sinon.stub(this.thumbnailerWeb,'downloadSourceImage',function(getOptions,callback){
        callback('derp')
      })
      var callback = sinon.stub()
      this.thumbnailerWeb.run('the function',['source_url','output_url',callback])
      assert(callback.getCall(0).args[0] == 'derp')
    })
    it('should try to make a thumbnail with the downloaded file',function(){
      sinon.stub(this.thumbnailerWeb,'downloadSourceImage',function(getOptions,callback){
        callback(null,'/tmp/foo')
      })
      var callback = sinon.stub()
      var theFunc = sinon.stub()
      this.thumbnailerWeb.run(theFunc,['source_url','width or something','output_url',callback])
      assert(theFunc.getCall(0).args.length == 4)
      assert(theFunc.getCall(0).args[0] == '/tmp/foo')
      assert(theFunc.getCall(0).args[1] == 'width or something')
      assert(theFunc.getCall(0).args[2].indexOf('/tmp') == '0')
      sinon.stub(this.thumbnailerWeb,'uploadThumbnail',function(thumbnailPath,postOptions,_callback){
        assert(theFunc.getCall(0).args[2] == thumbnailPath)
        _callback()
      })
      theFunc.getCall(0).args[3]()
    })
  })
  describe('downloadSourceImage',function(){
    beforeEach(function(){
      var request = sinon.stub().returns({
        on : sinon.stub(),
        pipe : sinon.stub()
      })
      request.defaultResponse = {
        statusCode : 200
      }
      request.get = sinon.stub().returns({
        on : function(a,b){
          if(a == 'error' && request.emitsError){
            b(new Error())
          }
          else if(a == 'response'){
            b(request.defaultResponse)
          }
        },
        once : sinon.stub(),
        pipe : sinon.stub()
      })
      this.request = request
      this.ThumbnailerWeb.request = request;
      this.ThumbnailerWeb.fs = {
        createWriteStream : sinon.stub().returns({
          on : function(a,b){
            if(a == 'close'){
              b()
            }
          }
        })
      }
    })
    afterEach(function(){
      this.ThumbnailerWeb.request = require('request');
    })
    it('should create a request with the options if it receives getOptions as an object',function(){
      var callback = sinon.stub()
      var options = {}
      this.thumbnailerWeb.downloadSourceImage(options,callback)
      assert(this.request.callCount == 1)
      assert(this.request.getCall(0).args[0] == options)
      this.ThumbnailerWeb.request = require('request');
    })
    it('should create a request with the url if it receives getOptions as a string',function(){
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge.jpg'
      this.thumbnailerWeb.downloadSourceImage(options,callback)
      assert(this.request.get.callCount == 1)
      assert(this.request.get.getCall(0).args[0] == 'http://foobar.com/hogehoge.jpg')
    })
    it('should callback with an error if request emits an error',function(){
      this.request.emitsError = true
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge'
      this.thumbnailerWeb.downloadSourceImage(options,callback)
      this.request.emitsError = true
      assert(callback.getCall(0).args[0] instanceof Error)
    })
    it('should callback with null if successful',function(){
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge'
      this.thumbnailerWeb.downloadSourceImage(options,callback)
      assert(callback.getCall(0).args[0] === null)
    })
  })
  describe('uploadThumbnail',function(){
    beforeEach(function(){
      var on = function(a,b){
        if(a == 'error' && request.emitsError){
          b(new Error())
        }
        else if(a == 'response'){
          b(request.defaultResponse)
        }
        else if(a == 'end'){
          b()
        }
      }
      var request = sinon.stub(this.ThumbnailerWeb,'request').returns({
        on : on
      })
      this.ThumbnailerWeb.request = request;
      var fs = {
        createReadStream : sinon.stub().returns({
          pipe : sinon.stub()
        }),
        stat : function(a,b){
          b(null,{
            size: 10
          })
        },
        unlink : function(){}
      }
      this.ThumbnailerWeb.fs = fs
      this.fs = fs
      sinon.stub(fs,'unlink',function(path,callback){
        callback()
      })
      request.defaultResponse = {
        statusCode : 200
      }
      request.put = sinon.stub().returns({
        on : on
      })
      this.request = request
    })
    afterEach(function(){
      this.ThumbnailerWeb.request = require('request');
    })
    it('should create a request with the options if it receives postOptions as an object',function(){
      var callback = sinon.stub()
      var options = {}
      this.thumbnailerWeb.uploadThumbnail('thumbnail.png',options,callback)
      assert(this.request.callCount == 1)
      assert(this.request.getCall(0).args[0] == options)
      this.ThumbnailerWeb.request.restore()
    })
    it('should create a request with the url if it receives postOptions as a string',function(){
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge.jpg'
      this.thumbnailerWeb.uploadThumbnail('thumbnail.png',options,callback)
      assert(this.request.callCount == 1)
      assert(this.request.getCall(0).args[0].url == 'http://foobar.com/hogehoge.jpg')
      assert(this.request.getCall(0).args[0].method == 'PUT')
    })
    it('should callback with an error if the status is not 200',function(){
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge.jpg'
      this.request.defaultResponse = {
        statusCode : 404
      }
      this.thumbnailerWeb.uploadThumbnail('thumbnail.png',options,callback)
      assert(callback.getCall(0).args[0] instanceof Error)
    })
    it('should callback with an error if the request emits an error',function(){
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge.jpg'
      this.request.emitsError = true
      this.thumbnailerWeb.uploadThumbnail('thumbnail.png',options,callback)
      assert(callback.getCall(0).args[0] instanceof Error)
    })
    it('should callback with nothing if the requestis succesful',function(){
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge.jpg'
      this.thumbnailerWeb.uploadThumbnail('thumbnail.png',options,callback)
      assert(callback.getCall(0).args[0] === null)
    })
    it('should delete the file afterwards',function(){
      var callback = sinon.stub()
      var options = 'http://foobar.com/hogehoge.jpg'
      this.thumbnailerWeb.uploadThumbnail('thumbnail.png',options,callback)
      assert(this.fs.unlink.getCall(0).args[0] == 'thumbnail.png')
    })
  })
})
