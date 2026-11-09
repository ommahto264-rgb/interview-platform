import { Router } from "express";
import { requireAuth } from "../middleware/require-auth";
import { requireAdmin } from "../middleware/require-admin";
import { requireMember } from "../middleware/require-member";
import { createInterview, listInterviews, getInterview } from "../controllers/interviews";
import { createInterviewInvitation } from "../controllers/interview-invitations";
import { startInterview, completeInterview } from "../controllers/interview-lifecycle";
import { listInterviewSubmissions } from "../controllers/interview-submissions";
import { createInterviewEvaluation, listInterviewEvaluations,} from "../controllers/interview-evaluations";
export const interviewRouter = Router();

interviewRouter.post(
  "/:organizationId/interviews",
  requireAuth,
  requireAdmin,
  createInterview,
);

interviewRouter.get(
  "/:organizationId/interviews/:interviewId/evaluations",
  requireAuth,
  requireMember,
  listInterviewEvaluations,
);

interviewRouter.get(
  "/:organizationId/interviews",
  requireAuth,
  requireMember,
  listInterviews,
);

interviewRouter.get(
  "/:organizationId/interviews/:interviewId",
  requireAuth,
  requireMember,
  getInterview,
);

interviewRouter.post(
  "/:organizationId/interviews/:interviewId/invitations",
  requireAuth,
  requireMember,
  createInterviewInvitation,
);

interviewRouter.post(
  "/:organizationId/interviews/:interviewId/start",
  requireAuth,
  requireMember,
  startInterview,
);

interviewRouter.post(
  "/:organizationId/interviews/:interviewId/complete",
  requireAuth,
  requireMember,
  completeInterview,
);

interviewRouter.get(
  "/:organizationId/interviews/:interviewId/submissions",
  requireAuth,
  requireMember,
  listInterviewSubmissions,
);

interviewRouter.post(
  "/:organizationId/interviews/:interviewId/evaluations",
  requireAuth,
  requireMember,
  createInterviewEvaluation,
);
