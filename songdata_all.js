
/**
 * Пытаемся динамически импортировать файлы "songdata_1.js", "songdata_2.js", ...
 * пока не встретим ошибку (404 - файла нет).
 * Возвращаем массив (каждый элемент - объект из default-экспорта songdata_N.js).
 */

export async function loadAllSongData() {
  const allSongs = [];
  let index = 1; // начинаем с 1

  while (true) {
    const filePath = `./song_data/songdata_${index}.js`;
    try {
      // динамический импорт
      const module = await import(filePath);
      // в файлах songdata_N.js есть export default { ... }, берём module.default
      allSongs.push(module.default);
      index++;
    } catch (err) {
      // если не удалось импортировать (404 или SyntaxError) - прерываем цикл
      console.log(`No more files after songdata_${index}.js`, err.message);
      break;
    }
  }

  return allSongs;
}
