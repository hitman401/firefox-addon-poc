var button = document.getElementsByTagName('button')[0];
button.addEventListener('click', function() {
  var request = {
    port: parseInt(document.getElementById('port').value),
    launcherString: document.getElementById('launcher_string').value
  };
  self.port.emit('connect', request);
});

self.port.on('connectResponse', function(response) {
  var msg = 'Authorised with Launcher Successfully';
  if (response.error) {
    msg = 'Failed to authorise';
  }
  alert(msg);
});
