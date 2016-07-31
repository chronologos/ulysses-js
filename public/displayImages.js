function getImages(imageHolder) {
  $.ajax({
    url: '/user/images',
    success: function(data, status, jqXHR) {
      console.log("Retrieved following image paths from server");
      console.log(JSON.stringify(data));
      displayImages(imageHolder, data);
    },
    error: function(jqXHR, status, error) {
      console.log("Error getting image data");
      console.log(status);
      console.log(error);
    }
  });
}

function displayImages(imageHolder, images) {
  images.forEach(function(image) {
    console.log("Appending image with path " + image);
    var li = document.createElement('li');
    var img = document.createElement('img');
    img.src = 'images/' + image;
    li.appendChild(img);
    imageHolder.append(li);
  });
  console.log("Done appending images");
}

getImages($('ul#images'));