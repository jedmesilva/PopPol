import { Router, type IRouter } from "express";
import healthRouter from "./health";
import politiciansRouter from "./politicians";
import checkoutRouter from "./checkout";
import eventsRouter from "./events";

const router: IRouter = Router();

router.use(healthRouter);
router.use(politiciansRouter);
router.use(checkoutRouter);
router.use(eventsRouter);

export default router;
