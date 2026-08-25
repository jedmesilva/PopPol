import { Router, type IRouter } from "express";
import healthRouter from "./health";
import politiciansRouter from "./politicians";
import checkoutRouter from "./checkout";

const router: IRouter = Router();

router.use(healthRouter);
router.use(politiciansRouter);
router.use(checkoutRouter);

export default router;
