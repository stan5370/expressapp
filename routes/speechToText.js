const sdk = require('microsoft-cognitiveservices-speech-sdk');

module.exports = async (req, res) => {
  try {
    // 0) Env
    const key = process.env.SPEECH_KEY;
    const region = (process.env.SPEECH_REGION || '').toLowerCase();
    if (!key || !region) {
      return res.status(500).json({ error: 'Missing SPEECH_KEY or SPEECH_REGION (e.g., eastus).' });
    }

    // 1) Require WAV body
    const ct = req.get('content-type') || '';
    if (!ct.includes('audio/wav') && !ct.includes('audio/x-wav')) {
      return res.status(415).json({ error: 'Send raw WAV audio with Content-Type: audio/wav.' });
    }

    const wavBuffer = req.body;
    if (!wavBuffer || !wavBuffer.length) {
      return res.status(400).json({ error: 'No audio data received.' });
    }

    // 2) Quick WAV sanity check: RIFF...WAVE
    const isRiff = wavBuffer.slice(0, 4).toString('ascii') === 'RIFF';
    const isWave = wavBuffer.slice(8, 12).toString('ascii') === 'WAVE';
    if (!isRiff || !isWave) {
      return res.status(415).json({ error: 'Invalid WAV header. Provide RIFF/WAVE PCM WAV (e.g., 16kHz mono PCM).' });
    }

    // 3) Speech config (increase silence windows)
    const lang = (req.query.lang || 'en-US').trim();
    const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechRecognitionLanguage = lang;
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_InitialSilenceTimeoutMs, '20000');
    speechConfig.setProperty(sdk.PropertyId.SpeechServiceConnection_EndSilenceTimeoutMs, '5000');

    // 4) Feed WAV
    const push = sdk.AudioInputStream.createPushStream();
    push.write(wavBuffer);
    push.close();
    const audioConfig = sdk.AudioConfig.fromStreamInput(push);

    // 5) Continuous recognition (more tolerant than recognizeOnce)
    const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);

    const transcript = await new Promise((resolve, reject) => {
      let collected = '';

      recognizer.recognized = (_s, e) => {
        if (e.result?.text) collected += (collected ? ' ' : '') + e.result.text;
      };
      recognizer.canceled = (_s, e) => {
        if (collected) resolve(collected);
        else reject(new Error(e.errorDetails || 'Canceled'));
      };
      recognizer.sessionStopped = () => {
        recognizer.stopContinuousRecognitionAsync(
          () => resolve(collected || ''),
          (err) => reject(err)
        );
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          // Safety: stop after 25s total processing
          setTimeout(() => recognizer.stopContinuousRecognitionAsync(() => {}, reject), 25000);
        },
        reject
      );
    });

    if (transcript) {
      return res.json({ text: transcript, language: lang });
    }
    return res.status(400).json({ error: 'No speech recognized (silence or unsupported audio).' });

  } catch (err) {
    console.error('Speech-to-text error:', err);
    const details = err?.message || err?.toString?.();
    res.status(500).json({ error: `Speech-to-text conversion error: ${details}` });
  }
};