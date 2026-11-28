import * as customerOrderService from "../services/customerOrderService.js";

function makeServiceInput(req) {
  return {
    body: req.body || {},
    params: req.params || {},
    query: req.query || {},
    user: req.user,
    files: req.files || [],
  };
}

function respond(res, result) {
  return res.status(result.status).json(result.body);
}

export async function listMyOrders(req, res) {
  return respond(res, await customerOrderService.listMyOrders(makeServiceInput(req)));
}

export async function getMyOrder(req, res) {
  return respond(res, await customerOrderService.getMyOrder(makeServiceInput(req)));
}

export async function cancelMyOrder(req, res) {
  return respond(res, await customerOrderService.cancelMyOrder(makeServiceInput(req)));
}

export async function requestMyOrderReturn(req, res) {
  return respond(res, await customerOrderService.requestMyOrderReturn(makeServiceInput(req)));
}
export async function cancelMyOrderItem(req, res) {
  return respond(
    res,
    await customerOrderService.cancelMyOrderItem(makeServiceInput(req)),
  );
}
