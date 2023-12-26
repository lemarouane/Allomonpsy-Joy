import json
import base64
import openai
import io
import requests
from requests.exceptions import Timeout

openai.api_key = "sk-"

def transcribe_audio(audio_data):
    # Convert the audio data into a file-like object using io.BytesIO
    with io.BytesIO(audio_data) as audio_file:
        audio_file.name = "audio.mp3"  # Add a name attribute to the BytesIO object

        # Use the OpenAI API to transcribe the audio, specifying the model, file, and language
        response = openai.Audio.transcribe(model="whisper-1", file=audio_file, language="en")

    # Extract the transcribed text from the response
    transcription = response["text"]

    return transcription


def generate_chat_completion(messages):
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=messages,
        max_tokens=100, # Optional, change to desired value
    )
    return response.choices[0].message["content"]


def generate_audio(generated_text):
    # API key
    api_key = ""

    # Voice id
    voice_id = "21m00Tcm4TlvDq8ikWAM"

    # Voice params
    data = {
        "text": generated_text,
        "voice_settings": {
            "stability": 0,
            "similarity_boost": 0
        }
    }

    # Call endpoint
    url = f'https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?api_key={api_key}'
    headers = {
        'accept': 'audio/mpeg',
        'Content-Type': 'application/json'
    }

    try:
        # Add a 15-second timeout to the request
        response = requests.post(url, headers=headers, json=data, timeout=15)
    except Timeout:
        # Return None if the request times out
        return None

    # Bytes type is not JSON serializable
    # Convert to a Base64 string
    return base64.b64encode(response.content).decode('utf-8')


def handler(event, context):
    try:
        body = json.loads(event["body"])

        if 'audio' in body:
            audio_base64 = body["audio"]
            audio_data = base64.b64decode(audio_base64.split(",")[-1])
            transcription = transcribe_audio(audio_data)
            message_objects = body['messages'] + [{"role": "user", "content": transcription}]

        elif 'text' in body:
            transcription = body['text']
            message_objects = body['messages']
        else:
            raise ValueError("Invalid request format. Either 'audio' or 'text' key must be provided.")

        generated_text = generate_chat_completion(message_objects)

        # Check if audio response
        is_audio_response = body.get('isAudioResponse', False)

        if is_audio_response:
            generated_audio = generate_audio(generated_text)
        else:
            generated_audio = None

        response = {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps(
                {"transcription": transcription, "generated_text": generated_text, "generated_audio": generated_audio}),
        }
        return response

    except ValueError as ve:
        import traceback
        print(traceback.format_exc())
        print(f"ValueError: {str(ve)}")
        response = {
            "statusCode": 400,
            "body": json.dumps({"message": str(ve)}),
        }
        return response
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        print(f"Error: {str(e)}")
        response = {
            "statusCode": 500,
            "body": json.dumps({"message": "An error occurred while processing the request."}),
        }
        return response

