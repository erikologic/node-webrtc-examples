'use strict';

const createExample = require('../../lib/browser/example');

const description = 'This example demonstrates streaming an MP3 file from the server to the client using WebRTC.';

const remoteAudio = document.createElement('audio');
remoteAudio.autoplay = true;

async function beforeAnswer(peerConnection) {
  const remoteStream = new MediaStream(peerConnection.getReceivers().map(receiver => receiver.track));
  remoteAudio.srcObject = remoteStream;
  remoteAudio.play();

  const { close } = peerConnection;
  peerConnection.close = function () {
    remoteAudio.srcObject = null;
    return close.apply(this, arguments);
  };
}

createExample('stream-mp3', description, { beforeAnswer });

document.body.appendChild(remoteAudio);
