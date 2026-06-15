const generateInventoryNumber =
  () => {
    const year =
      new Date().getFullYear();

    const random =
      Math.floor(
        1000 +
          Math.random() * 9000
      );

    return `AMR-${year}-${random}`;
  };

module.exports =
  generateInventoryNumber;