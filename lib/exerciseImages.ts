const BASE_URL = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises';

/**
 * Retorna a URL da imagem de um exercício.
 * Imagens são carregadas sob demanda do GitHub.
 * @param imagePath - path relativo do array images[] (ex: "Alternate_Incline_Dumbbell_Curl/0.jpg")
 */
export function getExerciseImageUrl(imagePath: string): string {
  return `${BASE_URL}/${imagePath}`;
}
