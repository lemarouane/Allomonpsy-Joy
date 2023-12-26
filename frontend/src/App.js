import React, { useEffect, useRef, useState } from "react";
import { Amplify, API } from "aws-amplify";
import { Box, Button, Container, FormControlLabel, Grid, IconButton, List, ListItem, ListItemText, Paper, Switch, TextField, Typography } from '@mui/material';
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import MicIcon from '@mui/icons-material/Mic';
import MicRecorder from 'mic-recorder-to-mp3';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import SendIcon from "@mui/icons-material/Send";
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import { useTheme } from '@mui/material/styles';
import { keyframes, styled } from '@mui/system';
import PersonIcon from '@mui/icons-material/Person';



//La fonction de audio controls est géré en dehors de la fonction App pour garantir une bonne éfficacité et aussi la réutilisabilité .. aussi pour gérer de manière plus efficace l'état lié à l'enregistrement, à la lecture et au téléchargement audio, rendant votre application plus modulaire et organisée.

// programmation asynchrone pour que les operations doivent etre executés de maniere non bloquante, càd le user peut continuer à exécuter d'autre taches pendant l'attente d'autre taches.


// cette fonction pour permettre l'user de enregistrer des audios et l'option de les lire et aussi les envoyer et l'inverse
const AudioControls = ({ isAudioResponse, filterMessageObjects, messages, setMessages, handleBackendResponse }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [recorder, setRecorder] = useState(null);
  const [player, setPlayer] = useState(null);
  const [audioFile, setAudioFile] = useState(null);

  const startRecording = async () => {
    const newRecorder = new MicRecorder({ bitRate: 128 });

    try {
      await newRecorder.start();
      setIsRecording(true);
      setRecorder(newRecorder);
    } catch (e) {
      console.error(e);
      alert(e);
    }
  };

  const stopRecording = async () => {
    if (!recorder) return;

    try {
      const [buffer, blob] = await recorder.stop().getMp3();
      const audioFile = new File(buffer, "voice-message.mp3", {
        type: blob.type,
        lastModified: Date.now(),
      });
      setPlayer(new Audio(URL.createObjectURL(audioFile)));
      setIsRecording(false);
      setAudioFile(audioFile);
    } catch (e) {
      console.error(e);
      alert(e);
    }
  };

  const playRecording = () => {
    if (player) {
      player.play();
    }
  };

  Amplify.configure({
    Auth: {
      mandatorySignIn: false,
    },
    API: {
      endpoints: [
        {
          name: "api",
          endpoint: "https://0zujemibxl.execute-api.us-east-1.amazonaws.com/dev"
        }
      ]
    }
  });


  return (
    <Container>
      <Box sx={{ width: "100%", mt: 4 }}>
        <Grid container spacing={2} justifyContent="flex-end">
          <Grid item xs={12} md>
            <IconButton
              color="primary"
              aria-label="start recording"
              onClick={startRecording}
              disabled={isRecording}
            >
              <MicIcon />
            </IconButton>
          </Grid>
          <Grid item xs={12} md>
            <IconButton
              color="secondary"
              aria-label="stop recording"
              onClick={stopRecording}
              disabled={!isRecording}
            >
              <FiberManualRecordIcon />
            </IconButton>
          </Grid>
          <Grid item xs="auto">
            <Button
              variant="contained"
              disableElevation
              onClick={playRecording}
              disabled={isRecording}
            >
              Play Recording
            </Button>
          </Grid>
          <SendButton audioFile={audioFile} isAudioResponse={isAudioResponse} filterMessageObjects={filterMessageObjects}
            messages={messages} handleBackendResponse={handleBackendResponse}
            setMessages={setMessages} />
        </Grid>
      </Box>
    </Container>
  )

}



// cette fonction pour donner le choix entre la reponse vocale ou pas
const ResponseFormatToggle = ({ isAudioResponse, setIsAudioResponse }) => {


  const handleToggleChange = (event) => {
    setIsAudioResponse(event.target.checked);
  };

  return (
    <Box sx={{ display: "flex", justifyContent: "center", marginTop: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={isAudioResponse}
            onChange={handleToggleChange}
            color="primary"
          />
        }
        label="Audio response"
      />
    </Box>
  );
}


const pulse = keyframes`
0% {
  transform: scale(1);
  opacity: 1;
}
50% {
  transform: scale(1.1);
  opacity: 0.7;
}
100% {
  transform: scale(1);
  opacity: 1;
}
`;


const ThinkingBubbleStyled = styled(MoreHorizIcon)`
  animation: ${pulse} 1.2s ease-in-out infinite;
  margin-bottom: -5px;
`;


const ThinkingBubble = () => {
  const theme = useTheme();
  return <ThinkingBubbleStyled theme={theme} sx={{ marginBottom: '-5px' }} />;
};


const SendButton = ({ audioFile, isAudioResponse, filterMessageObjects, messages,
  setMessages, handleBackendResponse }) => {
  const theme = useTheme();

  const uploadAudio = async () => {


    if (!audioFile) {
      console.log("No audio file to upload");
      return;
    }

    try {

      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Audio = reader.result;

        // Add a unique id to the message to be able to uptade it later
        const messageId = new Date().getTime();

        // Create the message objects
        let messageObjects = filterMessageObjects(messages)

        // Add user's audio message to the messages array
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "user", content: "🎤 Audio Message", audio: new Audio(base64Audio), text: "🎤 Audio Message", id: messageId },
        ]);

        // Add thinking bubble
        setMessages((prevMessages) => [
          ...prevMessages,
          { role: "assistant", content: <ThinkingBubble theme={theme} sx={{ marginBottom: '-5px' }} />, text: <ThinkingBubble theme={theme} sx={{ marginBottom: '-5px' }} />, key: "thinking" },
        ]);

        const response = await API.post("api", "/get-answer", {
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            audio: base64Audio,
            messages: messageObjects,
            isAudioResponse
          },
        });

        // Remove the thinking bubble
        setMessages((prevMessages) => {
          return prevMessages.filter((message) => message.key !== "thinking");
        });
        handleBackendResponse(response, messageId);
      };
      reader.readAsDataURL(audioFile);

    } catch (error) {
      console.error("Erreur lors du chargement de votre fichier audio:", error);
      alert(error)
    }
  };

  return (
    <Grid item xs="auto">
      <Button
        variant="contained"
        color="primary"
        disableElevation
        onClick={uploadAudio}
        disabled={!audioFile}
        startIcon={<CloudUploadIcon />}
      >
        Upload Audio
      </Button>
    </Grid>
  );

}


// fonction pour permettre l'user d'ecrire son message comme un input

const MessageInput = ({ message, setMessage, isAudioResponse, handleSendMessage }) => {
  const handleInputChange = (event) => {
    setMessage(event.target.value);
  };

  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      handleSendMessage();
    }
  };

  return (
    <Box sx={{ display: "flex", alignItems: "center", marginTop: 2 }}>
      {/* Utilisez l'icône PersonIcon à la place du texte du message */}
      <PersonIcon style={{ marginRight: '8px' }} />

      <TextField
        variant="outlined"
        fullWidth
        label="Type your message"
        value={message}
        onChange={handleInputChange}
        onKeyPress={handleKeyPress}
      />
      <IconButton
        color="primary"
        onClick={() => handleSendMessage(isAudioResponse)}
        disabled={message.trim() === ""}
      >
        <SendIcon />
      </IconButton>
    </Box>
  );
};




function App() {

  const mockMessages = [
    {
      role: 'assistant',
      Contenu : 'Bonjour, je suis Joy, un assistant virtuel de la plateforme AlloMonPsy. Mon rôle est de vous accompagner et de vous soutenir dans votre bien-être mental.',
      text: 'Bonjour, je suis Joy, un assistant virtuel de la plateforme AlloMonPsy. Mon rôle est de vous accompagner et de vous soutenir dans votre bien-être mental.',
    },
  ];

  const [isAudioResponse, setIsAudioResponse] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState(mockMessages);
  const theme = useTheme();


  // c'est une fonction pour l'affichage le titre du chatbot et le header
  const ChatHeader = () => {
    return (
      <Typography variant="h4" align="center" gutterBottom>
        Joy-AlloMonPsy
      </Typography>
    )
  }


// dans notre interface on aura deux types de messages 
// la premiere generé par l'user  : UserMessage
// la 2eme par Joy : AgentMessage




  const UserMessage = styled('div', { shouldForwardProp: (prop) => prop !== 'audio' })`
  position: relative;
  background-color: ${({ theme }) => theme.palette.primary.main};
  color: ${({ theme }) => theme.palette.primary.contrastText};
  padding: ${({ theme }) => theme.spacing(1, 2)};
  padding-right: ${({ theme, audio }) => (audio ? theme.spacing(6) : theme.spacing(2))};
  border-radius: 1rem;
  border-top-right-radius: 0;
  align-self: flex-end;
  max-width: 80%;
  word-wrap: break-word;
`;


  const AgentMessage = styled('div')`
position: relative;
background-color: ${({ theme }) => theme.palette.grey[300]};
color: ${({ theme }) => theme.palette.text.primary};
padding: ${({ theme }) => theme.spacing(1, 2)};
border-radius: 1rem;
border-top-left-radius: 0;
align-self: flex-end;
max-width: 80%;
word-wrap: break-word;
`;


  const MessageWrapper = styled('div')`
display: flex;
margin-bottom: ${({ theme }) => theme.spacing(1)};
justify-content: ${({ align }) => (align === 'user' ? 'flex-end' : 'flex-start')};
`;



// cette fonction pour l'affichage des messages echangées entre le user et le chatbot
  const ChatMessages = ({ messages }) => {
    const theme = useTheme();
    const bottomRef = useRef(null);

    const scrollToBottom = () => {
      if (bottomRef.current) {
        if (typeof bottomRef.current.scrollIntoViewIfNeeded === 'function') {
          bottomRef.current.scrollIntoViewIfNeeded({ behavior: 'smooth' });
        } else {
          bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }
    };

    // Hook that scrolls the chat to the bottom whenever the messages prop changes
    useEffect(() => {
      scrollToBottom();
    }, [messages]);


    return (
      <Container>
        <Box sx={{ width: '100%', mt: 4, maxHeight: 300, minHeight: 300, overflow: 'auto' }}>
          <Paper elevation={0} sx={{ padding: 2 }}>
            <List>
              {messages.map((message, index) => (
                <ListItem key={index} sx={{ padding: 0 }}>
                  <ListItemText
                    sx={{ margin: 0 }}
                    primary={
                      <MessageWrapper align={message.role}>
                        {message.role === 'user' ? (
                          <>
                            <UserMessage theme={theme} audio={message.audio}>
                              {message.text}
                              {message.audio && (
                                <IconButton
                                  size="small"
                                  sx={{
                                    position: 'absolute',
                                    top: '50%',
                                    right: 8,
                                    transform: 'translateY(-50%)'
                                  }}
                                  onClick={() => message.audio.play()}
                                >
                                  <VolumeUpIcon fontSize="small" />
                                </IconButton>
                              )}
                            </UserMessage>
                          </>
                        ) : (
                          <AgentMessage theme={theme}>
                            {message.text}
                          </AgentMessage>
                        )}
                      </MessageWrapper>
                    }
                  />
                </ListItem>
              ))}
              <div ref={bottomRef} />
            </List>
          </Paper>
        </Box>
      </Container>
    )

  }

  function filterMessageObjects(list) {
    return list.map(({ role, content }) => ({ role, content }));
  }


  const handleSendMessage = async () => {

    if (message.trim() !== "") {

      // Send the message to the chat

      // Add the new message to the chat area
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "user", content: message, text: message, audio: null },
      ]);

      // Clear the input field
      setMessage("");

      // Add thinking bubble
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: "assistant", content: <ThinkingBubble theme={theme} sx={{ marginBottom: '-5px' }} />, text: <ThinkingBubble theme={theme} sx={{ marginBottom: '-5px' }} />, key: "thinking" },
      ]);

      // Create backend chat input
      let messageObjects = filterMessageObjects(messages)
      messageObjects.push({ role: "user", content: message })

      // Create endpoint for just getting the completion
      try {
        // Send the text message to the backend
        const response = await API.post("api", "/get-answer", {
          headers: {
            "Content-Type": "application/json",
          },
          body: {
            text: message,
            messages: messageObjects,
            isAudioResponse
          },
        });

        // Remove the thinking bubble
        setMessages((prevMessages) => {
          return prevMessages.filter((message) => message.key !== "thinking");
        });
        handleBackendResponse(response); // Add function call

      } catch (error) {
        console.error("Error sending text message:", error);
        alert(error);
      }

    }
  };

  const handleBackendResponse = (response, id = null) => {

    const generatedText = response.generated_text;
    const generatedAudio = response.generated_audio;
    const transcription = response.transcription;


    const audioElement = generatedAudio
      ? new Audio(`data:audio/mpeg;base64,${generatedAudio}`)
      : null;


    const AudioMessage = () => (
      <span>
        {generatedText}{" "}
        {audioElement && (
          <IconButton
            aria-label="play-message"
            onClick={() => {
              audioElement.play();
            }}
          >
            <VolumeUpIcon style={{ cursor: "pointer" }} fontSize="small" />
          </IconButton>
        )}
      </span>
    );

    if (id) {
      setMessages((prevMessages) => {
        const updatedMessages = prevMessages.map((message) => {
          if (message.id && message.id === id) {
            return {
              ...message,
              content: transcription,
            };
          }
          return message;
        });
        return [
          ...updatedMessages,
          {
            role: "assistant",
            content: generatedText,
            audio: audioElement,
            text: <AudioMessage />,
          },
        ];
      });
    } else {
      // Simply add the response when no messageId is involved
      setMessages((prevMessages) => [
        ...prevMessages,
        {
          role: "assistant",
          content: generatedText,
          audio: audioElement,
          text: <AudioMessage />,
        },
      ]);
    }

  }

  return (
    <Container maxWidth="sm" sx={{ pt: 2 }}>
      <ChatHeader />
      <ChatMessages messages={messages} />
      <AudioControls
        isAudioResponse={isAudioResponse}
        filterMessageObjects={filterMessageObjects}
        messages={messages}
        setMessages={setMessages}
        handleBackendResponse={handleBackendResponse}
      />
      <MessageInput
        message={message}
        setMessage={setMessage}
        isAudioResponse={isAudioResponse}
        handleSendMessage={handleSendMessage}
        handleBackendResponse={handleBackendResponse}
      />
      <ResponseFormatToggle isAudioResponse={isAudioResponse} setIsAudioResponse={setIsAudioResponse} />
    </Container>
  );
}


export default App;