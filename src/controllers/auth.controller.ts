import { Request, Response } from 'express';

function helloWorld(req: Request, res: Response) {
	res.send("Hello, world!");
}

const authController = {
	helloWorld
}

export default authController;
