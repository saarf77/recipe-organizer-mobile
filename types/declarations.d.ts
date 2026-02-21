// Ambient declaration for optional native ML Kit module.
// Install with: npx expo install @react-native-ml-kit/text-recognition
declare module '@react-native-ml-kit/text-recognition' {
  interface TextBlock {
    text: string;
  }
  interface TextRecognitionResult {
    blocks: TextBlock[];
    text: string;
  }
  const TextRecognition: {
    recognize(imageUri: string): Promise<TextRecognitionResult>;
  };
  export default TextRecognition;
}
