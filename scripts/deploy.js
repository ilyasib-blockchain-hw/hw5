async function main() {
    const [deployer] = await ethers.getSigners();

    console.log("Deploying contracts with the account:", deployer.address);

    console.log("Account balance:", (await deployer.getBalance()).toString());

    const Token = await ethers.getContractFactory("TugrikToken");
    const tugrikToken = await Token.deploy();

    const TugrikDao = await ethers.getContractFactory("TugrikDao");
    const tugrikDao = await TugrikDao.deploy(tugrikToken.address);

    console.log("Token address:", tugrikToken.address);
    console.log("Dao address:", tugrikDao.address)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });