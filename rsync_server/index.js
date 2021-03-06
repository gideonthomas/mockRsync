var express = require('express'),
  bodyParser = require('body-parser'),
  cookieParser = require('cookie-parser'),
  session = require('express-session'),
  Filer = require('filer'),
  fs = new Filer.FileSystem({
    provider: new Filer.FileSystem.providers.Memory()
  }),
  rsync = require('./lib/rsync'),
  sourceList,
  syncTable = {},
  nunjucks = require('nunjucks'),
  path = require('path'),
  env = nunjucks.configure([path.join(__dirname, '../rsync_client')], {
    autoescape: true,
    watch: false
  });

var app = express();
env.express(app);
app.use(bodyParser.json());
app.use(cookieParser());
app.use(session({
  secret: 'rsync_cookie'
}));
app.use("/", express.static(path.join(__dirname, "../rsync_client")));

function generateSyncId() {
  var str,
    generate = true;

  while (generate) {
    str = '';
    for (var i = 0; i < 5; i++) {
      str += (Math.floor(Math.random() * 100) + 1) % 2 ?
        String.fromCharCode(Math.floor(Math.random() * 26) + 65) :
        Math.floor(Math.random() * 10);
    }
    if (getUser(str) == null) {
      generate = false;
    }
  }
  return str;
}

function getUser(syncId) {
  for (var u in syncTable) {
    if (syncTable[u] == syncId) {
      return u;
    }
  }
  return null;
}

function endSync(syncId) {
  var user = getUser(syncId);
  if (user)
    delete syncTable[user];
}

app.get('/', function (req, res) {
  res.render('index.html');
});

// GET /api/sync?user=abc
app.get('/api/sync', function (req, res) {
  if (!req.query.hasOwnProperty('user')) {
    res.send(400, {
      error: 'No user identified'
    });
  } else if (syncTable.hasOwnProperty(req.query.user)) {
    res.send(423, {
      error: 'A sync with this user is already in progress'
    });
  } else {
    var id = generateSyncId();
    syncTable[req.query.user] = id;
    res.send(200, {
      sync_id: id
    });
  }
});

app.post('/api/sync/:syncId/sources', function (req, res) {
  if (!req.param('syncId') || !getUser(req.param('syncId'))) {
    res.send(403, 'Sync not initiated');
    return;
  }
  // Error reading message body
  req.session.path = req.body.path;
  req.session.sourceList = req.body.srcList;
  fs.mkdir('/projects', function (err) {
    res.write('Posted successfully');
    res.end();
  });
});

app.get('/api/sync/:syncId/checksums', function (req, res) {
  if (!req.param('syncId') || !getUser(req.param('syncId'))) {
    res.send(403, 'Sync not initiated');
    return;
  }

  var options = {
    size: 5,
    links: false,
    recursive: true
  };
  rsync.checksums(fs, '/projects', req.session.sourceList, options, function (err, data) {
    if (err) {
      endSync(req.param('syncId'));
      console.log(err);
      res.send(500, err);
    } else {
      res.json({
        checksums: data
      });
    }
  });
});

app.put('/api/sync/:syncId/diffs', function (req, res) {
  if (!req.param('syncId') || !getUser(req.param('syncId'))) {
    res.send(403, 'Sync not initiated');
    return;
  }

  var diffs = req.body.diffs;
  for (var i = 0; i < diffs.length; i++) {
    for (var j = 0; j < diffs[i].contents.length; j++) {
      for (var k = 0; k < diffs[i].contents[j].diff.length; k++) {
        if (diffs[i].contents[j].diff[k].data) {
          diffs[i].contents[j].diff[k].data = diffs[i].contents[j].diff[k].data;
          // Deal with special-cased flattened typed arrays in WebSQL (see put() below)
          if (diffs[i].contents[j].diff[k].data.__isUint8Array) {
            diffs[i].contents[j].diff[k].data = new Uint8Array(diffs[i].contents[j].diff[k].data.__array);
          }
        }
      }
    }
  }

  rsync.patch(fs, req.session.path, diffs, {
    size: 5,
    links: false,
    recursive: true
  }, function (err, data) {
    if (err) {
      endSync(req.param('syncId'));
      console.log(err);
      res.send(500, err);
    } else {
      fs.stat('/projects/proj_1', function (err, stats) {
        if (err) {
          console.log(err);
          res.send(500, err);
          return;
        } else {
          if (!stats.isDirectory()) {
            console.log('/projects/proj_1 is not a directory!');
          } else {
            console.log('created /projects/proj_1');
            fs.readFile('/projects/proj_1/index.html', 'utf8', function (err, data) {
              if (err) {
                console.log(err);
                res.send(500, err);
                return;
              } else {
                console.log(data);
                if (!(data == "Hello World")) {
                  console.log("index.html contents don't match");
                } else {
                  console.log("index.html contents are kosher");
                  fs.readFile('/projects/proj_1/styles.css', 'utf8', function (err, data) {
                    if (err) {
                      console.log(err);
                      res.send(500, err);
                      return;
                    } else {
                      if (!(data == "Hello World")) {
                        console.log("styles.css contents don't match");
                      } else {
                        console.log("styles.css contents are super");
                      }
                    }
                  });
                }
              }
            });
          }
        }
      });
    }
  });
  endSync(req.param('syncId'));
  res.write('diff success!');
  res.end();
});

app.listen(3900);
