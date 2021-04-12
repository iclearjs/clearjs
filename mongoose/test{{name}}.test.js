'use strict';

const mock = require('egg-mock');

describe('test/mongoose.test.js', () => {
  let app;
  before(() => {
    app = mock.app({
      baseDir: 'apps/mongoose-test',
    });
    return app.ready();
  });

  after(() => app.close());
  afterEach(mock.restore);

  it('should GET /', () => {
    return app.httpRequest()
      .get('/')
      .expect('hi, mongoose')
      .expect(200);
  });
});
