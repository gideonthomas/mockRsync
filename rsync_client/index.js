var fs = new Filer.FileSystem({provider: new Filer.FileSystem.providers.Memory()}),
    syncID,
    paths,
    api = 'http://localhost:3901/api/sync/';

function text(id, text, error) {
  $(id)
  .html(text)
  .show();
  
  if(error) {
    $(id).css("color", "red");
  }
}

fs.mkdir('/projects', function(error) {
  if(error) {
    text('#createDir1', 'Error generating /projects: ' + error, true);
  } else {
    path = '/projects';
    text('#createDir1', 'Created /projects');
    fs.mkdir('/projects/proj_1', function(error) {
      if(error) {
        text('#createDir2', 'Error generating /projects/proj_1: ' + error, true);
      } else {
        text('#createDir2', 'Created /projects/proj_1');
        fs.writeFile('/projects/proj_1/index.html', 'Hello World', function(error) {
          if(error) {
            text('#createFile1', 'Error generating /projects/proj_1/index.html: ' + error, true);
          } else {
            text('#createFile1', 'Created /projects/proj_1/index.html');
            fs.writeFile('/projects/proj_1/styles.css', 'Hello World', function(error) {
              if(error) {
                text('#createFile2', 'Error generating /projects/proj_1/styles.css: ' + error, true);
              } else {
                text('#createFile2', 'Created /projects/proj_1/styles.css');
                $.get(api + '?user=cdot', function(data) {
                  if(!data.sync_id) {
                    text('#getSyncId', 'Could not receive sync id from server', true);
                  } else {
                    text('#getSyncId', 'Retrieved sync id');
                    syncID = data.sync_id;
                  }
                })
                .done(function() {
                  rsync.sourceList(fs, path, {recursive: true, size: 5}, function(error, results) {
                    if(error) {
                      text('#sourceList', 'Error getting source list: ' + error, true);
                    } else {
                      text('#sourceList', 'Generated source list');
                      $.post(api + syncID + '/sources', 
                             {path: path, srcList: results},
                             function(data) {
                              if(data) {
                                text('#sourceListPost', 'Posted source list to server');
                              } else {
                                text('#sourceListPost', 'Posting source list to server failed', true);
                              }
                            })
                      .done(function() {
                        $.get(api + syncID + '/checksums', function(data) {
                          if(data) {
                            text('#checksumsGet', 'Received checksums from server');
                          } else {
                            text('#checksumsGet', 'Unable to receive checksums', true);
                          }
                          return data;
                        })
                        .done(function(data) {
                          var checksums = data.checksums;
                          rsync.diff(fs, path, checksums, {recursive: true, size: 5}, function(error, diffs) {
                            if(error) {
                              text('#diffCalc', 'Could not calculate diffs: ' + error, true);
                            } else {
                              text('#diffCalc', 'Successfully calculated diffs');
                              $.ajax(api + syncID + '/diffs', {type: 'PUT', processData: false, data: { diffs: diffs }})
                              .done(function(data) {
                                if(data) {
                                  text('#syncSuccess', 'Synced successfully');
                                } else {
                                  text('#syncSuccess', 'Error while syncing with server', true);
                                }
                              });
                            }
                          });
                        });
                      });
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