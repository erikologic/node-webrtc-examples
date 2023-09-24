// server.js
'use strict';

const ffmpeg = require('fluent-ffmpeg');
const { RTCAudioSource } = require('wrtc').nonstandard;
const FILE_PATH = 'input.mp3';
const { PassThrough } = require('stream');

// function createData(bitsPerSample) {
//   const sampleRate = 44100;
//   const channelCount = 1;
//   const numberOfFrames = sampleRate / 100;  // 10 ms

//   const length = channelCount * numberOfFrames;
//   const byteLength = length * bitsPerSample / 8;

//   const samples = {
//     8: new Int8Array(length),
//     16: new Int16Array(length),
//     32: new Int32Array(length)
//   }[bitsPerSample] || new Uint8Array(byteLength);

//   samples[0] = -1 * Math.pow(2, bitsPerSample) / 2;

//   return {
//     samples,
//     sampleRate,
//     bitsPerSample,
//     channelCount,
//     numberOfFrames
//   };
// }

const sampleRate = 44100;  // Assume 44100 Hz sample rate
const bitsPerSample = 16;  // 16-bit samples
const channelCount = 2;  // Stereo audio

function createAudioData(buffer) {
  const numberOfFrames = buffer.length / (bitsPerSample / 8 * channelCount);  // Calculate the number of frames

  // Convert buffer to an appropriate typed array for the bit depth
  const samples = new Int16Array(buffer.buffer, buffer.byteOffset, buffer.length / 2);

  return {
    samples,
    sampleRate,
    bitsPerSample,
    channelCount,
    numberOfFrames
  };
}


function beforeOffer(peerConnection) {
  const source = new RTCAudioSource();
  const track = source.createTrack();
  peerConnection.addTransceiver(track);

  const highWaterMark = 1024 * 1024 * 10;
  const duplex = new PassThrough({ readableHighWaterMark: highWaterMark, writableHighWaterMark: highWaterMark, highWaterMark });

  const audioFile = ffmpeg(FILE_PATH)
    .format('s16le')  // Output raw PCM data
    .audioCodec('pcm_s16le')
    .audioChannels(channelCount)
    .audioFrequency(sampleRate)
    // .native()
    .on('error', (err) => {
      console.error('An error occurred while decoding the audio file:', err.message);
    })
    .on('end', () => {
      console.log('Audio file decoding finished');
      // stream();
    }).pipe(duplex);

  // we need to send 10 ms at the time
  const chunkSize = sampleRate / 100 * channelCount * bitsPerSample / 8;

  // start a loop to consume the buffer, loading into a Int16Array chunk size of data
  const interval = setInterval(() => {
    const chunk = duplex.read(chunkSize);
    if (chunk === null) {
      return;
    }

    // Create a new buffer to hold the slice of data
    const chunkBuffer = Buffer.alloc(chunkSize);

    // Copy the slice of data to the new buffer
    chunk.copy(chunkBuffer, 0, 0, chunkSize);

    // Convert the new buffer to a Int16Array
    const samples = new Int16Array(chunkBuffer.buffer, chunkBuffer.byteOffset, chunkSize / 2);

    source.onData({
      samples,
      sampleRate,
      bitsPerSample,
      channelCount,
      numberOfFrames: samples.length / channelCount  // Correct, as length is already in terms of elements
    });

  }, 10);


  duplex.on('end', () => {
    console.log('duplex end');
    clearInterval(interval);
  });


  // Handle cleanup upon peer connection closure
  const { close } = peerConnection;
  peerConnection.close = function () {
    track.stop();
    return close.apply(this, arguments);
  };
}

module.exports = { beforeOffer };
