export function rpcMethod(
  _target: any,
  _propertyKey: string,
  descriptor: PropertyDescriptor,
) {
  descriptor.value.isRpcMethod = true;
}
