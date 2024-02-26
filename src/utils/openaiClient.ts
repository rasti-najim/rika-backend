import { OpenAI, ClientOptions } from "openai";

const openai = new OpenAI(process.env.OPENAI_API_KEY as ClientOptions);

export default openai;
