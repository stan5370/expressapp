const sdk = require('microsoft-cognitiveservices-speech-sdk');

module.exports = async (req, res) => {
  try {
    console.log(`Processing request for url "${req.originalUrl}"`);

    // 1. Get the input text
    let text = req.query.text || '';
    
    if (!text && req.body) {
      if (typeof req.body === 'object' && req.body.text) {
        text = req.body.text;
      } else if (typeof req.body === 'string') {
        text = req.body.trim();
      }
    }

    if (!text) {
      return res.status(400).json({ error: 'Missing text input.' });
    }

    // 2. Configure Speech SDK
    const speechConfig = sdk.SpeechConfig.fromSubscription(
      process.env.SPEECH_KEY,
      process.env.SPEECH_REGION
    );
    speechConfig.speechSynthesisVoiceName = 'en-US-JennyNeural';
    speechConfig.speechSynthesisOutputFormat =
      sdk.SpeechSynthesisOutputFormat.Audio16Khz32KBitRateMonoMp3;

    // 3. Generate speech audio (in memory)
    const synthesizer = new sdk.SpeechSynthesizer(speechConfig);
    const result = await new Promise((resolve, reject) => {
      synthesizer.speakTextAsync(
        text,
        r => {
          synthesizer.close();
          resolve(r);
        },
        e => {
          synthesizer.close();
          reject(e);
        }
      );
    });

    if (result.reason !== sdk.ResultReason.SynthesizingAudioCompleted) {
      console.log('Speech synthesis failed:', result);
      return res.status(500).json({ error: 'Speech synthesis failed.' });
    }

    // 4. Return audio file to client
    const audioBuffer = Buffer.from(result.audioData);
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Disposition': 'inline; filename="speech.mp3"',
      'Access-Control-Allow-Origin': '*',
    }).send(audioBuffer);

  } catch (err) {
    console.error('Speech synthesis error:', err);
    res.status(500).json({ error: 'Azure Speech synthesis error.' });
  }
};