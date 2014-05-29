var fs = new Filer.FileSystem({
    provider: new Filer.FileSystem.providers.Memory()
  }),
  syncID,
  paths,
  api = 'http://localhost:3900/api/sync/';

function u8toArray(u8) {
  var array = [];
  var len = u8.length;
  for(var i = 0; i < len; i++) {
    array[i] = u8[i];
  }
  return array;
}

function text(id, text, error) {
  $(id)
    .html(text)
    .show();

  if (error) {
    $(id).css("color", "red");
  }
}

var f = function () {
  $.get(api + syncID + '/checksums', function (data) {
    if (data) {
      text('#checksumsGet', 'Received checksums from server');
    } else {
      text('#checksumsGet', 'Unable to receive checksums', true);
    }
    return data;
  })
    .done(function (data) {
      var checksums = data.checksums;
      rsync.diff(fs, path, checksums, {
        recursive: true,
        size: 5
      }, function (error, diffs) {
        if (error) {
          text('#diffCalc', 'Could not calculate diffs: ' + error, true);
        } else {
          text('#diffCalc', 'Successfully calculated diffs');
          for(var i = 0; i < diffs.length; i++) {
            for(var j = 0; j < diffs[i].contents.length; j++) {
              for(var k = 0; k < diffs[i].contents[j].diff.length; k++) {
                if (Object.prototype.toString.call(diffs[i].contents[j].diff[k].data) === "[object Uint8Array]") {
                  diffs[i].contents[j].diff[k].data = {
                    __isUint8Array: true,
                    __array: u8toArray(diffs[i].contents[j].diff[k].data)
                  };
                }
              }
            }
          }
          $.ajax({
            type: 'PUT',
            data: JSON.stringify({
              diffs: diffs
            }),
            contentType: 'application/json',
            url: api + syncID + '/diffs',
            statusCode: {
              200: function (response) {},
              201: function (response) {},
              401: function (response) {},
              404: function (response) {}
            },
            success: function (data) {
              if (data) {
                text('#syncSuccess', 'Sync successful');
              } else {
                text('#syncSuccess', 'Sync failed', true);
              }
            },
            error: function (e) {
              console.log("Error " + e.messages);
            }
          })
        }
      });
    });
};

fs.mkdir('/projects', function (error) {
  if (error) {
    text('#createDir1', 'Error generating /projects: ' + error, true);
  } else {
    path = '/projects';
    text('#createDir1', 'Created /projects');
    fs.mkdir('/projects/proj_1', function (error) {
      if (error) {
        text('#createDir2', 'Error generating /projects/proj_1: ' + error, true);
      } else {
        text('#createDir2', 'Created /projects/proj_1');
        fs.writeFile('/projects/proj_1/index.html', 'Hello World', function (error) {
          if (error) {
            text('#createFile1', 'Error generating /projects/proj_1/index.html: ' + error, true);
          } else {
            text('#createFile1', 'Created /projects/proj_1/index.html');
            fs.writeFile('/projects/proj_1/styles.css', 'Hello World', function (error) {
              if (error) {
                text('#createFile2', 'Error generating /projects/proj_1/styles.css: ' + error, true);
              } else {
                text('#createFile2', 'Created /projects/proj_1/styles.css');
                $.get('http://localhost:3900/api/sync?user=cdot', function (data) {
                  if (!data.sync_id) {
                    text('#getSyncId', 'Could not receive sync id from server', true);
                  } else {
                    text('#getSyncId', 'Retrieved sync id');
                    syncID = data.sync_id;
                  }
                })
                  .done(function () {
                    rsync.sourceList(fs, path, {
                      recursive: true,
                      size: 5
                    }, function (error, results) {
                      if (error) {
                        text('#sourceList', 'Error getting source list: ' + error, true);
                      } else {
                        text('#sourceList', 'Generated source list');
                        $.ajax({
                          type: 'POST',
                          data: JSON.stringify({
                            path: path,
                            srcList: results
                          }),
                          contentType: 'application/json',
                          url: api + syncID + '/sources',
                          statusCode: {
                            200: function (response) {},
                            201: function (response) {},
                            401: function (response) {},
                            404: function (response) {}
                          },
                          success: function (data) {
                            if (data) {
                              text('#sourceListPost', 'Posted source list to server');
                            } else {
                              text('#sourceListPost', 'Posting source list to server failed', true);
                            }
                          },
                          error: function (e) {
                            console.log("Error " + e.messages);
                          }
                        }).done(f);
                      }
                    });
                  });
              }
            });
          }
        });
      }
    });
  }
});