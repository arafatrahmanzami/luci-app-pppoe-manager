include $(TOPDIR)/rules.mk

PKG_NAME:=luci-app-pppoe-manager
PKG_VERSION:=1.1.0
PKG_RELEASE:=4

PKG_MAINTAINER:=Arafat Rahman Zami
PKG_LICENSE:=Apache-2.0

LUCI_TITLE:=LuCI PPPoE Server Manager
LUCI_DEPENDS:=+luci-base +rp-pppoe-server +conntrack
LUCI_PKGARCH:=all

define Package/luci-app-pppoe-manager/conffiles
/etc/config/ppoemanager
endef

define Package/luci-app-pppoe-manager/postinst
#!/bin/sh
[ -n "$${IPKG_INSTROOT}" ] || {
	/etc/init.d/rpcd restart
	/etc/init.d/uhttpd restart
}
exit 0
endef

include $(TOPDIR)/feeds/luci/luci.mk

$(eval $(call BuildPackage,luci-app-pppoe-manager))
