module.exports =function (req, res) {
  return {
    code: 0,
    clientId: 'caocao_gateway_default',
    clientLabel: null,
    clientInfo: {
      id: 'caocao_gateway_default',
      data: {
        account: 'caocao',
        nickname: 'caocao',
        uid: 'caocao_gateway_default',
      },
      isAdmin: false,
      allowMultiLogin: false
    }
  }
}