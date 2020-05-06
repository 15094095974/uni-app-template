import base from '@/config/baseUrl';
import store from '@/config/store';
import $http from '@/config/requestConfig'
import { getLocation, setShare } from '@/plugins/wxJsSDK';
/**
 * 安卓IOS交互
 */
export const appMutual = (name, query = null, errCallback) => {
	if (/android/i.test(navigator.userAgent)) {
		if (window.shangChengView) {
			if (typeof(query) == "object") {
				query = JSON.stringify(query);
			}
			window.shangChengView[name](query);
		} else {
			errCallback && errCallback();
		}
	} else if (/ios|iphone|ipod|pad/i.test(navigator.userAgent)) {
		if (window.webkit) {
			window.webkit.messageHandlers[name].postMessage(query)
		} else {
			errCallback && errCallback();
		}
	}
};
/**
 * 获取url中的参数
 */
export const getUrlData = () => {
	var strs;
	var url = window.location.href; //获取url中"?"符后的字串
	var theRequest = new Object();
	if (url.indexOf("?") != -1) {
		url = url.substr(url.indexOf("?"));
		var str = url.substr(1);
		strs = str.split("&");
		for (var i = 0; i < strs.length; i++) {
			var index = strs[i].indexOf("=");
			theRequest[strs[i].slice(0, index)] = unescape(strs[i].slice(index + 1, strs[i].length));
		}
	}
	return theRequest;
}
//微信支付
export const weiXinPay = (data, callback) => {
	var wxConfigObj = {
		appId: data.appId,
		timeStamp: data.timeStamp,
		nonceStr: data.nonceStr,
		package: data.package,
		signType: data.signType,
		paySign: data.sign
	};

	function onBridgeReady() {
		window.WeixinJSBridge.invoke("getBrandWCPayRequest", wxConfigObj, function(
			res
		) {
			if (res.err_msg == "get_brand_wcpay_request:ok") {
				callback && callback(res);
			} else // 使用以上方式判断前端返回,微信团队郑重提示：res.err_msg将在用户支付成功后返回    ok，但并不保证它绝对可靠。
				if (res.err_msg == "get_brand_wcpay_request:cancel") {
					// common.loadWarn('支付遇到问题，您取消了支付');
				} else
			if (res.err_msg == "get_brand_wcpay_request:fail") {
				// common.myConfirm('支付遇到问题,您可能需要重新登录', '', function () {
				//   obj.wxLoginOAuth();
				// });
			}
		});
	}
	if (typeof window.WeixinJSBridge == "undefined") {
		if (document.addEventListener) {
			document.addEventListener("WeixinJSBridgeReady", onBridgeReady, false);
		} else if (document.attachEvent) {
			document.attachEvent("WeixinJSBridgeReady", onBridgeReady);
			document.attachEvent("onWeixinJSBridgeReady", onBridgeReady);
		}
	} else {
		onBridgeReady();
	}
};
// 浏览器判断
export const getBrowser = () => {
	let ua = navigator.userAgent.toLowerCase();
	if (ua.match(/MicroMessenger/i) == "micromessenger") {
		return "微信";
	}
	return "其他";
};
// 获取地址信息
export const getLatLonH5 = function(successCallback, errCallback) {
	if (getBrowser() == '微信') {
		getLocation().then(res => {
			successCallback(res);
		}, err => {
			console.log("位置信息错误", err);
			errCallback("位置信息获取失败");
		});
	} else {
		let clearTime = setTimeout(() => {
			errCallback("获取经纬度超时");
		}, 5000);
		window.getAppLatLon = function(res) {
			clearTimeout(clearTime);
			successCallback(res);
		}
		appMutual("getAppLatLon", true);
	}
};
// 公众号分享
export const publicShare = function (info = {}) {
	if (getBrowser() == "微信") {
		let shareInfo = {
			title: info.shareTitle || info.title || base.share.title,
			desc: info.desc || info.shareContent || base.share.desc,
			imgUrl: info.imgUrl || info.shareImg || base.share.imgUrl,
			link: info.link || info.shareUrl || base.share.link,
		};
		if (store.state.userInfo.token) {
			if (shareInfo.link.indexOf("?") >= 0) {
				shareInfo.link += "&recommendCode=" + store.state.userInfo.uid;
			} else {
				shareInfo.link += "?recommendCode=" + store.state.userInfo.uid;
			}
		}
		return setShare(shareInfo);
	}
}

//获取code
function getLogin(type) {
	let urlNow = encodeURIComponent(window.location.href);
	let url =
		`https://open.weixin.qq.com/connect/oauth2/authorize?appid=${
		base.publicAppId
		}&redirect_uri=${urlNow}&response_type=code&scope=snsapi_userinfo&state=${type}#wechat_redirect`;
	window.location.replace(url);
}

function getApiLogin(result, type, callback) {
	$http.post("api/open/v1/login", {
			wxPublicOpenId: result.openId,
			unionid: result.unionid,
			nickname: result.nickname,
			headImg: result.headImg
		})
		.then(res => {
			if (res.thirdLoginSuccess) {
				store.commit('setUserInfo', res);
				callback && callback();
				uni.showToast({
					title: "欢迎回来",
					icon: "none"
				});
			} else {
				store.commit('setUserInfo', res);
				if (type == "judge") {
					uni.showModal({
						title: "提示",
						content: "您还未绑定手机号，请先绑定手机号",
						confirmText: "去绑定",
						cancelText: "再逛会",
						success: (res) => {
							if (res.confirm) {
								uni.navigateTo({
									url: "/pages/user/bindPhone"
								});
							}
						}
					});
				} else if (type == "force") {
					uni.navigateTo({
						url: "/pages/user/bindPhone"
					});
				}
			}
		});
}
//判断是否登录，登录处理
let isGetOpenId = true;

function getRecommendCode() {
	var url = window.location.href;
	let codeIndex = url.indexOf("recommendCode=");
	if (codeIndex >= 0) {
		let recommendCode = url.substr(codeIndex + 14);
		if (recommendCode.indexOf("&") >= 0) {
			return recommendCode.substr(0, recommendCode.indexOf("&"));
		} else if (recommendCode.indexOf("?") >= 0) {
			return recommendCode.substr(0, recommendCode.indexOf("?"));
		} else if (recommendCode.indexOf("/") >= 0) {
			return recommendCode.substr(0, recommendCode.indexOf("/"));
		} else if (recommendCode.indexOf("#") >= 0) {
			return recommendCode.substr(0, recommendCode.indexOf("#"));
		}
		return recommendCode;
	} else {
		return;
	}
}
export const h5Login = function(type = "judge", callback) {
	var getRequest = getUrlData();
	let recommendCode = getRecommendCode();
	if (recommendCode && recommendCode !== "null" && recommendCode !== "undefined") {
		uni.setStorageSync("recommendCode", recommendCode);
	}
	if (getBrowser() == "微信") {
		if (store.state.userInfo.thirdLoginSuccess === false) {
			getApiLogin(store.state.userInfo, type, () => {
				callback && callback();
			});
		} else if (getRequest.code) {
			if (isGetOpenId) {
				isGetOpenId = false;
				let httpData = {
					code: getRequest.code
				};
				if (recommendCode && recommendCode !== "null" && recommendCode !== "undefined") {
					httpData.recommendUid = recommendCode;
				} else {
					let recommendCode = uni.getStorageSync("recommendCode");
					if (recommendCode && recommendCode !== "null" && recommendCode !== "undefined") {
						httpData.recommendUid = recommendCode;
					}
				}
				$http.get("api/open/v2/get_public_login", httpData)
					.then(result => {
						store.commit('setUserInfo', result);
						//publicShare();
						callback && callback();
						uni.showToast({
							title: "欢迎回来",
							icon: "none"
						});
					}, () => {
						isGetOpenId = true;
					});
			}
		} else {
			getLogin(type);
		}
	} else {
		if (getRequest.userToken) {
			store.commit('setUserInfo', {
				token: getRequest.userToken
			});
			$http.get("api/mime/v1/info").then(res => {
				store.commit('setUserInfo', res);
				callback && callback();
			});
		} else {
			appMutual("jumpLogin", null, function() {
				if (type == "force") {
					uni.navigateTo({
						url: "/pages/user/login"
					});
				} else {
					uni.showModal({
						title: "提示",
						content: "您还未登录，请先登录~",
						confirmText: "去登录",
						cancelText: "再逛会",
						success: (res) => {
							if (res.confirm) {
								uni.navigateTo({
									url: "/pages/user/login"
								});
							}
						}
					});
				}
			});
		}
	}
}
