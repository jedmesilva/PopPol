import { Router, type IRouter } from "express";
import healthRouter from "./health";
import politiciansRouter from "./politicians";

const router: IRouter = Router();

router.use(healthRouter);
router.use(politiciansRouter);

export default router;
