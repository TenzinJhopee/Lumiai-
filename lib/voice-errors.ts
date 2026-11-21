export function microphoneErrorMessage(reason: unknown) {
  const name = typeof reason === "object" && reason !== null && "name" in reason
    ? String(reason.name)
    : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Microphone permission was denied. Allow microphone access or type your question.";
  }
  return "The microphone could not be started. You can type your question instead.";
}
