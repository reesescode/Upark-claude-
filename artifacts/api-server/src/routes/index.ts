import { Router, type IRouter } from "express";
import healthRouter from "./health";
import parkingRouter from "./parking";
import profileRouter from "./profile";
import routingRouter from "./routing";
import rewardsRouter from "./rewards";

const router: IRouter = Router();

router.use(healthRouter);
router.use(parkingRouter);
router.use(profileRouter);
router.use(routingRouter);
router.use(rewardsRouter);

export default router;
