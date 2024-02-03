function dotProduct(vecA, vecB) {
    let product = 0;
    for (let i = 0; i < vecA.length; i++) {
        product += vecA[i] * vecB[i];
    }
    return product;
}
function magnitude(vec) {
    let sum = 0;
    for (let i = 0; i < vec.length; i++) {
        sum += vec[i] * vec[i];
    }
    return Math.sqrt(sum);
}
function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) {
        throw "Vectors do not have the same dimension";
    }
    const dotProd = dotProduct(vecA, vecB);
    const magnitudeA = magnitude(vecA);
    const magnitudeB = magnitude(vecB);
    if (magnitudeA === 0 || magnitudeB === 0) {
        throw "One of the vectors is zero";
    }
    return dotProd / (magnitudeA * magnitudeB);
}
module.exports = cosineSimilarity;
