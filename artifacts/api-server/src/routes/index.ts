import { Router, type IRouter } from "express";
import healthRouter from "./health";
import voiceRouter from "./voice";
import p2pRouter from "./p2p";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/voice", voiceRouter);
router.use("/p2p", p2pRouter);

export default router;
