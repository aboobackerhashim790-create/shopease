export default function cropImage(imageUrl, cropArea) {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = cropArea.width;
      canvas.height = cropArea.height;

      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("Could not prepare the image crop."));
        return;
      }

      context.drawImage(
        image,
        cropArea.x,
        cropArea.y,
        cropArea.width,
        cropArea.height,
        0,
        0,
        cropArea.width,
        cropArea.height,
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not create the cropped image."));
        },
        "image/jpeg",
        0.92,
      );
    };

    image.onerror = () =>
      reject(new Error("Could not read the selected image."));
    image.src = imageUrl;
  });
}
