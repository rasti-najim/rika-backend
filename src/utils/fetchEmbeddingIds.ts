async function fetchEmbeddingIds(): Promise<any> {
  try {
    const response = await fetch(
      `https://${process.env.PINECONE_HUMAN_PERSONAS_INDEX_HOST}/vectors/list?limit=100"`,
      {
        method: "GET",
        headers: {
          "Api-Key": process.env.PINECONE_API_KEY || "",
          accept: "application/json",
        },
      }
    );
    const data = await response.json();
    const ids = data.vectors.map((vector: { id: string }) => vector.id);
    return Promise.resolve(ids);
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

export default fetchEmbeddingIds;
