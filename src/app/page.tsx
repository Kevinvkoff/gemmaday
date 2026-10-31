import { Chat } from "./chat";
import { getAiModel } from "@/lib/gemini";

export default function Home() {
  return <Chat model={getAiModel()} />;
}
