var PROTOCOL_APP_ID = 'test';
var POLL_INTERVAL = 200;
var POST_MESSAGE = 'hello';
var POST_VALUE = 'world';

describe('Xframe Messaging Client', function() {
  var frame, client, client2, clock;

  function FakeWindow() {
    this.postMessage = sinon.spy();
    this.messages = function(index) {
      var list = this.postMessage.args.map(function(args) { return JSON.parse(args[0]) });
      return (index !== undefined) ? list[index] : list;
    };
    this.respond = function(value, index) {
      var req = this.messages(index || 0);
      req.value = value;
      client.end(req);
    };
  }

  beforeEach(function() {
    frame = new FakeWindow()
    clock = sinon.useFakeTimers()
    client = IframeClient.create(PROTOCOL_APP_ID).listen()
    client2 = IframeClient.create(PROTOCOL_APP_ID).listen()
  })

  afterEach(function() {
    clock.restore()
    client.dispose()
    client2.dispose()
  })

  it ('configures a client with a generic host origin by default.', function() {
    expect(client.host).to.equal('*')
  })

  it ('configures a client with a custom host origin.', function() {
    var client2 = IframeClient.create(PROTOCOL_APP_ID, 'http://aweso.me')
    expect(client2.host).to.equal('http://aweso.me')
  })

  it ('creates clients with unique random GUIDs.', function() {
    var client2 = IframeClient.create(PROTOCOL_APP_ID)
    expect(client.id).to.match(/\w{8}-\w{4}-\w{4}-\w{4}-\w{12}/)
    expect(client.id).to.not.equal(client2.id)
  })

  it ('uses ".src" to resolve references to an embedded window source.', function() {
    var fakeIframe = { contentWindow: frame }
    expect(client.src(fakeIframe)).to.equal(frame)
    expect(client.src(frame)).to.equal(frame)
  })

  it ('uses ".post" to send a message with basic protocol.', function() {
    client.post(frame, POST_MESSAGE, POST_VALUE)
    expect(frame.postMessage.calledOnce).to.be.true
    expect(frame.messages(0)).to.deep.equal({
      'message': POST_MESSAGE,
      'value': POST_VALUE,
      '@app': PROTOCOL_APP_ID
    })
  })

  describe('.request', function() {
    it ('sends a message with response protocol.', function() {
      client.request(frame, POST_MESSAGE, POST_VALUE)
      expect(frame.postMessage.calledOnce).to.be.true
      expect(frame.messages(0)).to.deep.equal({
        'message': POST_MESSAGE,
        'value': POST_VALUE,
        'id': client.id + '-0000',
        '@app': PROTOCOL_APP_ID
      })
    })

    it ('assigns unique protocol IDs to each requested message.', function() {
      client.request(frame, 'a')
      client.request(frame, 'b')
      client.request(frame, 'c')
      expect(frame.postMessage.calledThrice).to.be.true
      expect(frame.messages(0).id).to.equal(client.id + '-0000')
      expect(frame.messages(1).id).to.equal(client.id + '-0001')
      expect(frame.messages(2).id).to.equal(client.id + '-0002')
    })

    it ('repeatedly polls a message request.', function() {
      client.request(frame, 'hello', 'world')
      clock.tick(POLL_INTERVAL * 2)

      var first = frame.messages(0);
      expect(frame.postMessage.calledThrice).to.be.true
      expect(frame.messages(1)).to.deep.equal(first)
      expect(frame.messages(2)).to.deep.equal(first)
    })

    it ('stops polling a message request once the frame responds.', function() {
      var callback = sinon.spy()

      client.request(frame, POST_MESSAGE, null, callback) // first call
      clock.tick(POLL_INTERVAL) // second call
      frame.respond(POST_VALUE)
      clock.tick(POLL_INTERVAL) // no additional calls

      expect(frame.postMessage.calledTwice).to.be.true
      expect(callback.calledOnce).to.be.true
      expect(callback.calledWith(null, POST_VALUE)).to.be.true
    })

    it ('continues polling until all requests have received responses.', function() {
      var frame2 = new FakeWindow()
      client.request(frame, POST_MESSAGE) // frame1, first call
      client.request(frame2, POST_MESSAGE) // frame2, first call
      clock.tick(POLL_INTERVAL) // frame1 + frame2, second call
      frame.respond()
      clock.tick(POLL_INTERVAL) // frame2, third call
      frame2.respond()
      clock.tick(POLL_INTERVAL) // no additional calls

      expect(frame.postMessage.calledTwice).to.be.true
      expect(frame2.postMessage.calledThrice).to.be.true
    })

    it ('stops polling with error after a request has timed out.', function() {
      var DEFAULT_TIMEOUT = 15000;
      var MAX_ATTEMPTS = Math.floor(DEFAULT_TIMEOUT / POLL_INTERVAL);
      var callback = sinon.spy();
      client.request(frame, POST_MESSAGE, POST_VALUE, callback)
      clock.tick(POLL_INTERVAL * (MAX_ATTEMPTS + 1))

      expect(frame.postMessage.callCount).to.equal(MAX_ATTEMPTS)
      expect(callback.calledOnce).to.be.true

      var err = callback.lastCall.args[0];
      expect(err.message).to.match(/timeout/)
    })

    it ('stops polling with error after a custom timeout duration.', function() {
      var CUSTOM_TIMEOUT = 2000;
      var MAX_ATTEMPTS = Math.floor(CUSTOM_TIMEOUT / POLL_INTERVAL)
      var callback = sinon.spy();
      client.request(frame, POST_MESSAGE, POST_VALUE, callback, CUSTOM_TIMEOUT)
      clock.tick(POLL_INTERVAL * (MAX_ATTEMPTS + 1))

      expect(frame.postMessage.callCount).to.equal(MAX_ATTEMPTS)
      expect(callback.calledOnce).to.be.true

      var err = callback.lastCall.args[0];
      expect(err.message).to.match(/timeout/)
    })
  })

  describe('.listen', function() {
    var post = {
      'message': POST_MESSAGE,
      'value': POST_VALUE,
      '@app': PROTOCOL_APP_ID
    };

    it ('uses ".on" to register listening handlers.', function(done) {
      var context = {};

      client.on(POST_MESSAGE, function(evt, data) {
        expect(evt.source).to.equal(window)
        expect(data).to.equal(POST_VALUE)
        expect(this).to.equal(context)
        done()
      }, context)

      client.post(window, POST_MESSAGE, POST_VALUE)
    })

    it ('delegates responses to all relevant message handlers.', function(done) {
      var otherHandler = sinon.spy()
      var activeHandler = sinon.spy()

      client.on('other', otherHandler)
      client.on(POST_MESSAGE, activeHandler)
      client.on(POST_MESSAGE, function() {
        expect(otherHandler.called).to.be.false
        expect(activeHandler.calledOnce).to.be.true
        done()
      })

      client.post(window, POST_MESSAGE);
    })

    it ('posts response data back to another client.', function(done) {
      var REPLY = 'reply';
      var handler = sinon.stub().returns(REPLY)

      client.on(POST_MESSAGE, handler)

      client2.request(window, POST_MESSAGE, POST_VALUE, function(err, res) {
        expect(handler.calledOnce).to.be.true
        expect(res).to.equal(REPLY)
        done()
      })
    })
  })
})
