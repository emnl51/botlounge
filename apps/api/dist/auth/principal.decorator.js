import { createParamDecorator } from "@nestjs/common";
export const Principal = createParamDecorator((_data, context) => {
    return context.switchToHttp().getRequest().principal;
});
//# sourceMappingURL=principal.decorator.js.map